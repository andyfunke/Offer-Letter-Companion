import { Router, type IRouter } from "express";
import healthRouter from "./health";
import templatesRouter from "./templates";
import offersRouter from "./offers";
import authRouter from "./auth";
import adminUsersRouter from "./admin/users";
import adminIssuesRouter from "./admin/issues";
import adminConfigRouter from "./admin/config";
import exportRouter from "./export";
import telemetryRouter from "./telemetry";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/templates", templatesRouter);
router.use("/offers", offersRouter);
router.use("/telemetry", telemetryRouter);
router.use("/admin/users", adminUsersRouter);
router.use("/admin/issues", adminIssuesRouter);
router.use("/admin", adminConfigRouter);
router.use("/export", exportRouter);

export default router;
