import express from "express";
import session from "express-session";
import cors from "cors";
const userRouter = require('../routes/user');
const projectRouter = require('../routes/project');

const app = express();

app.use(express.json())

app.use(
  cors({

    origin: ["*"],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
  })
);

app.use(
  session({
    secret: '@codestates',
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 24 * 6 * 60 * 10000,
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    }
  }));

app.get("/",(req : express.Request , res : express.Response) =>{
  res.send("Hello World");
})
// app.post('/', userController.getProjectList);
app.use('/user', userRouter);
app.use('/project', projectRouter);

app.listen(4000,()=>console.log("server listening port 4000"));

export default app;