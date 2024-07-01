const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

//activation token times out in 1 week
const activationTimeout = 1000 * 60 * 60 * 24 * 7;

const signToken = (id) => {
	return jwt.sign({ id }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN,
	});
};

const createAndSendToken = (user, statusCode, req, res) => {
	const token = signToken(user._id);

	console.log(token);

	res.cookie('jwt', token, {
		expires: new Date(
			Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
		),
		httpOnly: true,
		secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
	});

	//remove password from output
	user.password = undefined;

	res.status(statusCode).json({
		status: 'success',
		token,
		data: {
			user,
		},
	});
};

exports.isLoggedIn = catchAsync(async (req, res, next) => {
	try {
		// get the token and check if it exists
		if (!req.cookies) {
			return next();
		}
		let token;
		if (!req.cookies.jwt) {
			if (
				req.headers.authorization &&
				req.headers.authorization.startsWith('Bearer')
			) {
				token = req.headers.authorization.split(' ')[1];
			} else {
				return next();
			}
		} else {
			token = req.cookies.jwt;
		}

		const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

		// check if the user exists
		const currentUser = await User.findById(decoded.id);
		if (!currentUser) {
			return next();
		}

		// check if the user changed password after the token was issued
		if (currentUser.changedPasswordAfter(decoded.iat)) {
			return next();
		}
		//we've passed the gauntlet. There is a logged in user.
		res.locals.user = currentUser;
		next();
	} catch (err) {
		next();
	}
});

exports.localOnly = (req, res, next) => {
	const ip = req._remoteAddress;
	if (ip.substring(ip.length() - 9, ip.length()) !== `127.0.0.1`) {
		return next(new AppError(`Request is not authorized.`, 403));
	}
	next();
};

exports.signup = catchAsync(async (req, res, next) => {
	//do not await User.create(req.body) so that the user cannot put whatever they want into the body.
	//Only take the necessary fields.
	const url = `${req.protocol}://${req.get('host')}/activate`;

	const playerExists = await User.findOne({ username: req.body.username });
	if (playerExists) {
		return next(
			new AppError('That username is taken. Try a different one.', 400)
		);
	}
	const emailExists = await User.findOne({ email: req.body.email });
	if (emailExists) {
		return next(new AppError('That e-mail is already registered.', 400));
	}

	const aToken = crypto.randomBytes(32).toString('hex');
	activationToken = crypto.createHash('sha256').update(aToken).digest('hex');

	const newUser = await User.create({
		username: req.body.username,
		active: false,
		email: req.body.email,
		password: req.body.password,
		passwordConfirm: req.body.passwordConfirm,
		activationToken,
		activationTokenExpires: Date.now() + activationTimeout,
		passwordChangedAt: req.body.passwordChangedAt
			? req.body.passwordChangedAt
			: null,
	});
	const emailRes = await new Email(
		newUser,
		`${url}/${activationToken}`
	).sendWelcome();

	//delete this document 10 seconds after the activation token times out
	setTimeout(async () => {
		try {
			const dp = await User.findOneAndDelete({
				_id: newUser._id,
				active: false,
				activationToken: { $ne: undefined },
			});
			if (dp) {
				console.log(
					`Deleted ${dp.fName} ${dp.lName} due to failure to activate account.`
				);
			} else {
				const activeUser = await User.findById(newUser._id);
				if (activeUser) {
					console.log(
						`User ${activeUser.fName} ${activeUser.lName} has activated their account.`
					);
				}
			}
		} catch (err) {
			console.log('Did not delete user.');
		}
		// }, process.env.ACTIVATION_TIMEOUT + 10000);
	}, activationTimeout + 10000);

	res.status(200).json({
		status: 'success',
		data: emailRes,
		message:
			'Successfully signed up. Check your e-mail for a confirmation link.',
	});
});

// exports.confirmRegistration = catchAsync(async (req, res, next) => {
// 	const user = await User.findOne({
// 		activationToken: req.params.token,
// 	});
// 	if (!user) {
// 		return next(new AppError('Token not found.', 404));
// 	}
// 	user.active = true;
// 	user.activationToken = undefined;
// 	user.activationTokenExpires = undefined;
// 	await user.save({ validateBeforeSave: false });
// 	createAndSendToken(user, 201, req, res);
// });

exports.login = catchAsync(async (req, res, next) => {
	const { email, password } = req.body;
	//check if email and password exists
	if (!email || !password) {
		return next(new AppError('Please provide email and password.', 400));
	}

	//check if user exists and password is correct
	const user = await User.findOne({ email: email.toLowerCase() }).select(
		'+password'
	);

	if (!user || !(await user.correctPassword(password, user.password))) {
		// return next(new AppError('Incorrect email or password', 401));
		return res.status(200).json({
			status: 'fail',
			message: 'Incorrect username or password',
		});
	} else if (!user.active) {
		return next(
			new AppError(
				'User is not active. Please check the e-mail associated with your account and activate your account.',
				401
			)
		);
	} else if (user.deleteUserAfter) {
		return next(
			new AppError(
				'Cannot log in at this time - please contact your administrator.',
				403
			)
		);
	}

	//if so, send the token back to the client
	createAndSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
	res.cookie('jwt', 'logged out', {
		expires: new Date(Date.now() + 1),
		httpOnly: true,
	});
	res.status(200).json({ status: 'success' });
	console.log('logged out');
};

exports.protect = catchAsync(async (req, res, next) => {
	// get the token and check if it exists
	let token;

	if (req.headers.authorization?.startsWith('Bearer')) {
		token = req.headers.authorization.split(' ')[1];
	} else if (req.cookies.jwt) {
		token = req.cookies.jwt;
	} else if (
		req.body.headers?.authorization &&
		req.body.headers?.authorization?.startsWith('Bearer')
	) {
		token = req.body.headers.authorization.split(' ')[1];
	}

	if (!token) {
		// return next(
		// 	new AppError('You are not logged in. Please log in for access.', 401)
		// );
		return res.redirect('/login');
	}
	// validate the token
	const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
	// check if the user exists
	const currentUser = await User.findById(decoded.id);
	if (!currentUser) {
		return res.redirect('/login');
	}
	// check if the user changed password after the token was issued
	if (currentUser.changedPasswordAfter(decoded.iat)) {
		return next(
			new AppError(
				'The password has changed since the token was created. Please log in again.',
				401
			)
		);
	}

	if (currentUser.deleteUserAfter) {
		return next(new AppError('User is unable to log in.', 401));
	}

	//we've passed the gauntlet. Grant access to the protected route.
	req.user = currentUser;
	res.locals.user = currentUser;
	next();
});

//Only for rendered pages, no errors. Just checks if a user is logged in (e.g. to render a logout/user menu)
exports.isLoggedIn = catchAsync(async (req, res, next) => {
	// get the token and check if it exists
	if (!req.cookies) {
		return next();
	}
	let token;
	if (!req.cookies.jwt) {
		if (
			req.headers.authorization &&
			req.headers.authorization.startsWith('Bearer')
		) {
			token = req.headers.authorization.split(' ')[1];
		} else {
			return next();
		}
	} else {
		token = req.cookies.jwt;
	}

	const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

	// check if the user exists
	const currentUser = await User.findById(decoded.id);
	if (!currentUser) {
		return next();
	}

	// check if the user changed password after the token was issued
	if (currentUser.changedPasswordAfter(decoded.iat)) {
		return next();
	}

	if (currentUser.deleteUserAfter) {
		return next();
	}

	//we've passed the gauntlet. There is a logged in user.
	res.locals.user = currentUser;
	next();
});

exports.getUser = catchAsync(async (req, res, next) => {
	if (!res.locals.user) {
		res.status(200).json({
			status: 'success',
			user: undefined,
		});
	} else {
		res.status(200).json({
			status: 'success',
			user: res.locals.user,
		});
	}
});

exports.restrictTo = (...roles) => {
	return (req, res, next) => {
		//roles is an array (e.g. ['admin','user'])
		//access is granted if the logged-in user has a role in the roles array

		if (!res.locals.user) {
			return res.redirect('/login');
		}

		if (!roles.includes(res.locals.user.role)) {
			return next(
				new AppError(
					'You do not have the necessary permission to perform this action',
					403
				)
			);
		}

		next();
	};
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
	//get the user email address
	const user = await User.findOne({ email: req.body.email });

	if (!user) {
		return res.status(200).json({
			status: 'success',
			message: 'Token sent to e-mail',
		});
	}

	const resetToken = user.createPasswordResetToken();
	//generate a random token, save it to the user's document
	await user.save({ validateBeforeSave: false });

	if (process.env.SEND_EMAILS === 'true') {
		//send it to the user's email
		try {
			const resetURL = `${req.protocol}://${req.get(
				'host'
			)}/resetPassword/${resetToken}`;
			await new Email(
				user,
				resetURL,
				process.env.EMAIL_FROM
			).sendPasswordReset();

			res.status(200).json({
				status: 'success',
				message: 'Token sent to e-mail',
			});
		} catch (err) {
			user.passwordResetToken = undefined;
			user.passwordResetExpires = undefined;
			await user.save({ validateBeforeSave: false });
			console.log(err.message);
			return next(
				new AppError(
					'There was an error sending the e-mail. Try again later.',
					500
				)
			);
		}
	}
});

exports.resetPassword = catchAsync(async (req, res, next) => {
	//get user based on token
	const hashedToken = crypto
		.createHash('sha256')
		.update(req.params.token)
		.digest('hex');

	//check that token has not expired; ensure that the user exists; change the password if so.
	const user = await User.findOne({
		passwordResetToken: hashedToken,
		passwordResetExpires: { $gte: new Date() },
	});
	if (!user) {
		return next(new AppError('Invalid or expired token.', 400));
	}
	user.password = req.body.password;
	user.passwordConfirm = req.body.passwordConfirm;
	user.passwordResetToken = undefined;
	user.passwordResetExpires = undefined;

	//update changedPasswordAt property for current user
	user.passwordChangedAt = Date.now();

	//user save and not findOneAndUpdate for passwords - we want to run the validators in these cases.
	await user.save();
	//log the user in, send JWT
	createAndSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
	//get the user from the collection
	const user = await User.findById(req.user.id).select('+password');

	//check if the POSTed (current) password is correct
	if (
		!user ||
		!(await user.correctPassword(req.body.currentPassword, user.password))
	) {
		return res.status(200).json({
			status: 'fail',
			message: 'Incorrect password',
		});
	} else if (req.body.password !== req.body.passwordConfirm) {
		return res.status(200).json({
			status: 'fail',
			message: 'Passwords do not match.',
		});
	}

	//if so, update the passwords
	user.password = req.body.password;
	user.passwordConfirm = req.body.passwordConfirm;
	user.passwordResetToken = undefined;
	user.passwordResetExpires = undefined;

	//user save and not findOneAndUpdate for passwords - we want to run the validators in these cases.
	await user.save();

	//log the user back in (send a new JWT) with the new password
	createAndSendToken(user, 200, req, res);
});

exports.activateAccount = catchAsync(async (req, res, next) => {
	const user = await User.findOne({
		activationToken: req.params.token,
		active: false,
	});
	if (!user) {
		return next(new AppError('Invalid activation token.', 404));
	}

	user.activationToken = '';
	user.activationTokenExpires = null;
	user.active = true;
	await user.save({ validateBeforeSave: false });

	createAndSendToken(user, 200, req, res);
});
