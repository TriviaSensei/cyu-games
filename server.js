const express = require('express');
const app = express();
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

dotenv.config({ path: './config.env' });
const port = process.env.PORT || 3000;

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DB_PASSWORD);

mongoose.connect(DB).then(async () => {
	console.log('DB connection successful');
});

const server = app.listen(port, () => {
	console.log(`App running on port ${port}`);
});

const http = require('http').Server(app);
const socketManager = require('./mvc/utils/socketManager')(http, server);

const userRouter = require('./mvc/routes/userRoutes');
const viewRouter = require('./mvc/routes/viewRoutes');
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());
app.set('view engine', 'pug');
//directory for views is /views
app.set('views', path.join(__dirname, 'mvc/views'));

app.use('/api/v1/users', userRouter);
app.use('/', viewRouter);
