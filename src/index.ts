import { createApp } from "./app";

const PORT = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Customer Experience API listening on port ${PORT}`);
});
