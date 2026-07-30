import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import index from "@/routes/index";
import auth from "@/routes/auth/index";
import organizations from "@/routes/organizations/index";

const app = createApp();

configureOpenAPI(app);

const routes = [
  index,
  auth,
  organizations,
] as const;

routes.forEach((route) => {
  app.route("/", route);
});

export type AppType = typeof routes[number];

export default app;
