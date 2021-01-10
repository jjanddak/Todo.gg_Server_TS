const express=require("express");
const cors=require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const userRouter = require('./routes/user');

const port = 4001;
const app=express();

app.use(bodyParser.json());

app.use(
	session({
		secret: "@todo.gg",
		resave: false,
		saveUninitialized: true,
	}),
);

app.use(
	cors({
		origin: true,
		methods: ["GET","POST"],
		credentials: true,
	}),
);

app.use(express.json());
// app.use(express.urlencoded({ extended: false }));

app.use('/user', userRouter);

app.listen(port, () => {
    console.log(`server listening on ${port}`);
});

module.exports = app;