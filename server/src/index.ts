import 'dotenv/config';
import app from "./app.js";

const port = process.env.PORT || 9091;

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
