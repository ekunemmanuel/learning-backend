import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import index from "@/routes/index";
import examples from "@/routes/examples/index";
import auth from "@/routes/auth/index";

const app = createApp();

configureOpenAPI(app);

const routes = [
  index,
  examples,
  auth,
] as const;

routes.forEach((route) => {
  app.route("/", route);
});

export type AppType = typeof routes[number];

export default app;
