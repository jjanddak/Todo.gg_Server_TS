import express from "express";
import session from "express-session";
import cors from "cors";

const app = express();
app.get("/",(req : express.Request , res : express.Response) =>{
  res.send("Hello World");
})
// app.post('/', userController.getProjectList);
// app.use('/user', userRouter);
// app.use('/project', projectRouter);

app.listen(4000,()=>console.log("server listening port 4000"));

export default app;