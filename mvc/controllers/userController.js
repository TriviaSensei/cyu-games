const User = require('../models/userModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
//wait 5 minutes before deleting a user
const deleteTimeout = 5 * 60 * 1000;

const filterObj = (obj, ...allowedFields) => {
	const newObj = {};
	Object.keys(obj).forEach((el) => {
		if (allowedFields.includes(el)) newObj[el] = obj[el];
	});
	return newObj;
};

//middleware for aliasing
//make the default sort by last name
exports.sortByName = (req, res, next) => {
	req.query.sort = 'lName';
	next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
	//error if user tries to POST password data
	if (req.body.password || req.body.passwordConfirm) {
		return next(
			new AppError(
				'This route is not for password updates. Please use the changePassword route',
				400
			)
		);
	}

	//update the user's information
	const updatedInfo = filterObj(
		req.body,
		'firstName',
		'lastName',
		'displayName',
		'email'
	);

	const updatedUser = await User.findByIdAndUpdate(req.user.id, updatedInfo, {
		new: true,
		runValidators: true,
	});
	res.status(200).json({
		status: 'success',
		data: {
			user: updatedUser,
		},
	});
});

exports.getUser = catchAsync(async (req, res, next) => {
	let user = await User.find({ slug: req.params.id }).select([
		'-email',
		'-password',
		'-passwordConfirm',
		'-passwordChangedAt',
	]);

	if (!user[0]) {
		user = await User.findById(req.params.id).select([
			'-email',
			'-password',
			'-passwordConfirm',
			'-passwordChangedAt',
		]);
		if (!user) {
			return res.status(404).json({
				stauts: 'error',
				message: 'User not found',
			});
		}
	}
	res.status(200).json({
		status: 'success',
		data: {
			user: user[0],
		},
	});
});

//standard routes
exports.getAllUsers = catchAsync(async (req, res, next) => {
	let users = await User.find().sort({
		active: 1,
		lastName: 1,
		firstName: 1,
	});

	if (!users) {
		return res.status(404).json({
			status: 'fail',
			message: 'Users not found',
		});
	}

	res.status(200).json({
		status: 'success',
		data: users,
	});
});

exports.deleteUser = catchAsync(async (req, res, next) => {
	const userToDelete = await User.findById(req.params.id);
	//make sure user is found
	if (!userToDelete) {
		return res.status(404).json({
			status: 'fail',
			message: 'User not found.',
		});
		//and is not the owner
	} else {
		if (userToDelete.role === 'owner') {
			return res.status(400).json({
				status: 'fail',
				message: 'Cannot delete owner.',
			});
		}
	}
	let action;
	if (!userToDelete.deleteAfter) {
		userToDelete.deleteAfter = Date.now() + deleteTimeout;
		setTimeout(
			async (id) => {
				const u = await User.findById(id);
				if (!u.deleteAfter) {
					console.log(`Did not delete user ${id}`);
					return;
				} else if (u.deleteAfter > new Date()) {
					console.log(`Not yet time to delete user ${id}`);
					return;
				} else {
					console.log(`Deleting user ${id}`);
					await u.delete();
				}
			},
			deleteTimeout + 10,
			req.params.id
		);

		action = 'delete';
	} else {
		userToDelete.deleteAfter = null;
		action = 'restore';
	}

	const data = await userToDelete.save({ validateBeforeSave: false });

	res.status(200).json({
		status: 'success',
		action,
		data,
	});
});

exports.getMe = catchAsync(async (req, res, next) => {
	if (!res.locals.user) return next(new AppError('You are not logged in', 403));

	res.status(200).json({
		status: 'success',
		data: res.locals.user,
	});
});

exports.updateUser = factory.updateOne(User);
