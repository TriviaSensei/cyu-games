const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const User = require('../models/userModel');

exports.httpsRedirect = (req, res, next) => {
	if (
		process.env.NODE_ENV === 'production' &&
		req.headers.host !== `localhost:${process.env.PORT}`
	) {
		if (req.header('x-forwarded-proto') !== 'https') {
			return res.redirect(`https://${req.header('host')}${req.url}`);
			// next();
		}
	}
	next();
};

exports.getHome = (req, res, next) => {
	if (res.locals.user)
		res.status(200).render('index', {
			title: 'Home',
			user: res.locals.user,
		});
	else
		res.status(200).render('account/login', {
			title: 'Login',
		});
};

exports.getSignup = (req, res, next) => {
	res.status(200).render('account/signup', {
		title: 'Signup',
		user: res.locals.user,
	});
};

exports.getActivation = async (req, res, next) => {
	if (res.locals.user) return res.redirect('/profile');

	res.status(200).render('account/activate', {
		title: 'Activate',
		token: req.params.token,
	});
};

exports.getPlay = (req, res, next) => {
	res.status(200).render('play', {
		title: 'Play',
		user: res.locals.user,
	});
};

exports.redirectToIndex = (req, res, next) => {
	if (req.originalUrl !== '/favicon.ico') return res.redirect(`/`);
	else
		res.status(404).json({
			status: 'fail',
		});
};
