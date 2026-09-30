import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import staffRouter from "./staff";
import clientsRouter from "./clients";
import clientGroupsRouter from "./client-groups";
import servicesRouter from "./services";
import appointmentsRouter from "./appointments";
import salesRouter from "./sales";
import inventoryRouter from "./inventory";
import loyaltyRouter from "./loyalty";
import membershipsRouter from "./memberships";
import giftCardsRouter from "./gift-cards";
import dashboardRouter from "./dashboard";
import tipsRouter from "./tips";
import financeRouter from "./finance";
import expensesRouter from "./expenses";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

router.use(requireAuth);
router.use(staffRouter);
router.use(clientsRouter);
router.use(clientGroupsRouter);
router.use(servicesRouter);
router.use(appointmentsRouter);
router.use(salesRouter);
router.use(inventoryRouter);
router.use(loyaltyRouter);
router.use(membershipsRouter);
router.use(giftCardsRouter);
router.use(dashboardRouter);
router.use(tipsRouter);
router.use(financeRouter);
router.use(expensesRouter);

export default router;
