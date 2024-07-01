const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

//this will delete one of any document, depending on what gets passed to it.
exports.deleteOne = (Model) =>
	catchAsync(async (req, res, next) => {
		const arr = req.originalUrl.trim().split('/');
		const loc = arr.length > 3 ? arr[3] : '';

		if (loc === 'users') {
			const userToDelete = await Model.findById(req.params.id);
			if (!userToDelete) {
				return res.status(404).json({
					status: 'fail',
					message: 'User not found.',
				});
			} else {
				if (userToDelete.role === 'owner') {
					return res.status(400).json({
						status: 'fail',
						message: 'Cannot delete owner.',
					});
				}
			}
		}

		const doc = await Model.findByIdAndDelete(req.params.id);

		if (!doc) {
			return res.status(404).json({
				status: 'fail',
				message: 'No document found with that ID.',
			});
		}

		res.status(204).json({
			status: 'success',
			data: null,
		});
	});

exports.updateOne = (Model) =>
	catchAsync(async (req, res, next) => {
		const arr = req.originalUrl.trim().split('/');
		const loc = arr.length > 3 ? arr[3] : '';

		if (loc.toLowerCase() === 'users') {
			const user = await Model.findById(req.params.id);
			if (!user) {
				return res.status(200).json({
					status: 'fail',
					message: 'User not found.',
				});
			}
			if (user.role === 'owner') {
				req.body.role = 'owner';
			}
		}

		let toReturn = null;

		const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
			runValidators: true,
		});
		if (!doc) {
			return next(new AppError('No document found with that ID.', 404));
		}

		res.status(200).json({
			status: 'success',
			data: toReturn || doc,
			message: loc.toLowerCase() === 'games' ? res.locals.message : '',
		});
	});

exports.createOne = (Model) =>
	catchAsync(async (req, res, next) => {
		const doc = await Model.create(req.body);

		res.status(201).json({
			status: 'success',
			//envelope the new object
			data: doc,
		});
	});

exports.getOne = (Model, popOptions) =>
	catchAsync(async (req, res, next) => {
		const arr = req.originalUrl.trim().split('/');
		const loc = arr.length > 3 ? arr[3] : '';
		let filter = { _id: req.params.id };

		query = Model.find(filter);

		if (popOptions) query = query.populate(popOptions);
		const doc = await query;

		if (!doc) {
			return next(new AppError('No document found with that ID.', 404));
		}

		if (loc === 'users') doc.password = '';

		res.status(200).json({
			status: 'success',
			// data: {
			//   data: doc,
			// },
			data: doc,
		});
	});

exports.getAll = (Model, popOptions) =>
	catchAsync(async (req, res, next) => {
		let filter = {};
		const arr = req.originalUrl.trim().split('/');
		const loc = arr.length > 3 ? arr[3] : '';

		if (loc === 'users') {
			req.query.sort = 'lastName';
		} else if (loc === 'games') {
			req.query.sort = '-lastModified';
		} else if (loc === 'venues') {
			let header;
			let host;
			let referer;
			req.rawHeaders.some((h, i) => {
				if (i % 2 === 0) {
					header = h;
				} else {
					if (header === 'Referer') {
						const tokens = h.split('/');
						if (tokens[tokens.length - 1].toLowerCase() !== 'admin') {
							req.query.filter = {
								isHidden: false,
							};
							return true;
						}
					}
				}
				return false;
			});
			req.query.sort = 'name';
		}

		let features;
		if (popOptions) {
			features = new APIFeatures(
				Model.find(filter).populate(popOptions),
				req.query
			)
				.filter()
				.sort()
				.limitFields()
				.paginate();
		} else {
			features = new APIFeatures(Model.find(filter), req.query)
				.filter()
				.sort()
				.limitFields()
				.paginate();
		}
		let doc = await features.query;
		// const tours = await Tour.find().where('duration').equals(5).where('difficulty').equals('easy');

		res.status(200).json({
			status: 'success',
			results: doc.length,
			data: doc,
		});
	});
