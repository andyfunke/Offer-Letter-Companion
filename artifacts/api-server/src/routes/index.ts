import { Router, type IRouter } from "express";
import healthRouter from "./health";
import templatesRouter from "./templates";
import offersRouter from "./offers";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/templates", templatesRouter);
router.use("/offers", offersRouter);

export default router;
