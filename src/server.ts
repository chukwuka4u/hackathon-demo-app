import 'dotenv/config'
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cron from "node-cron";
// This is the important part: imported from node_modules like any real
// consumer would, NOT a relative path into the package's source tree.
// If this resolves and typechecks, the package's `exports`/`types` fields
// in package.json are correct for real installs.
import { InstallmentPlanManager, InMemoryStorageAdapter } from "kora-installments";
import type { KoraCustomer } from "kora-installments";


// ---------------------------------------------------------------------------
// App wiring
// ---------------------------------------------------------------------------
const storage = new InMemoryStorageAdapter();
const key = process.env.KORA_API_KEY ?? ""
const manager = new InstallmentPlanManager({
  kora: { apiKey: key, baseUrl: "https://api.korapay.com" },
  storage,
});

const planIds: string[] = [];
const chargeSchedules = new Map<string, ReturnType<typeof cron.schedule>>();

const app = express();
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "..", "public")));

app.post("/api/plans", async (req, res) => {
  try {
    const { customerId, customer, totalAmount, currency, numberOfInstallments } = req.body as {
      customerId: string;
      customer: KoraCustomer;
      totalAmount: number;
      currency: "NGN";
      numberOfInstallments: number;
    };

    const result = await manager.createPlan({
      customerId,
      customer,
      totalAmount,
      currency,
      numberOfInstallments,
    });

    planIds.push(result.plan.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message, req: req.body });
  }
});

app.get("/api/plans", async (_req, res) => {
  const plans = [];
  for (const id of planIds) {
    const plan = await storage.getPlan(id);
    const installments = await storage.getInstallmentsByPlan(id);
    if (plan) plans.push({ plan, installments });
  }
  res.json(plans.reverse());
});

app.post("/api/plans/:id/activate", async (req, res) => {
  try {
    await manager.activatePlan(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/plans/:id/charge-schedule", async (req, res) => {
  try {
    const planId = req.params.id;
    const plan = await storage.getPlan(planId);
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    if (!chargeSchedules.has(planId)) {
      const task = cron.schedule("*/5 * * * * *", async () => {
        const installments = await storage.getInstallmentsByPlan(planId);
        const dueInstallment = installments.find((installment) => installment.status === "due" || installment.status === "pending");
        if (!dueInstallment) {
          task.stop();
          chargeSchedules.delete(planId);
          return;
        }
        await manager.chargeInstallment(dueInstallment.reference);
      });
      chargeSchedules.set(planId, task);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/installments/:reference/charge", async (req, res) => {
  try {
    await manager.chargeInstallment(req.params.reference);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Standalone test app running at http://localhost:${PORT}`);
  console.log(`Testing against kora-installments@${process.env.npm_package_dependencies_kora_installments ?? "installed tarball"}`);
});
