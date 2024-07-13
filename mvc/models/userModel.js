const mongoose = require('mongoose');
const crypto = require('crypto');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const Filter = require('bad-words');
const filter = new Filter();

const illegalNames = ['system', 'me'];

const userSchema = new mongoose.Schema({
	username: {
		type: String,
		trim: true,
		unique: true,
		required: [true, 'A player must have a user name.'],
		validate: {
			validator: (val) => {
				return (
					!illegalNames.includes(val.toLowerCase()) && !filter.isProfane(val)
				);
			},
			message: 'That username is not allowed.',
		},
	},
	displayName: {
		type: String,
		trim: true,
		unique: true,
		required: true,
	},
	active: Boolean,
	email: {
		type: String,
		trim: true,
		unique: true,
		lowercase: true,
		maxlength: [100, 'Enter a maximum of 100 characters.'],
		validate: [validator.isEmail, 'Please provide a valid e-mail address.'],
	},
	ratings: [Object],
	password: {
		type: String,
		minLength: 8,
		required: [true, 'A player must have a password.'],
		select: false,
	},
	passwordConfirm: {
		type: String,
		minLength: 8,
		required: [true, 'Please confirm your password.'],
		validate: {
			validator: function (val) {
				return val === this.password;
			},
			message: 'Passwords do not match',
		},
	},
	passwordResetToken: {
		type: String,
		select: false,
	},
	passwordResetExpires: { type: Date, select: false },
	passwordChangedAt: { type: Date, select: false },

	activationToken: {
		type: String,
		select: false,
	},
	activationTokenExpires: {
		type: Date,
		select: false,
	},
	deleteUserAfter: {
		type: Date,
	},
});

userSchema.pre('save', async function (next) {
	//only run this function if the password was modified
	if (!this.isModified('password')) {
		return next();
	}
	//hash the password
	this.password = await bcrypt.hash(this.password, 12);
	//will not persist this field to the DB
	//required as input, but does not have to be persisted to DB
	this.passwordConfirm = undefined;
	next();
});

userSchema.pre('save', function (next) {
	//run this if password was modified and the document isn't new
	if (!this.isModified('password') || this.isNew) return next();

	this.passwordChangedAt = Date.now() - 1000;
	next();
});

// //this runs whenever we run anything starting with "find"
// userSchema.pre(/^find/, function (next) {
//   this.find({ active: { $ne: false } });
//   next();
// });

userSchema.methods.correctPassword = async function (candidatePW, userPW) {
	return await bcrypt.compare(candidatePW, userPW);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
	//this points to the current document in an instance method
	if (this.passwordChangedAt) {
		const changedTimestamp = parseInt(
			this.passwordChangedAt.getTime() / 1000,
			10
		);
		return changedTimestamp > JWTTimestamp;
	}

	//false means the password has not been changed after the token was issued (which is good)
	return false;
};

userSchema.methods.createPasswordResetToken = function () {
	//generate the resetToken
	const resetToken = crypto.randomBytes(32).toString('hex');
	//set the reset token field for this user
	this.passwordResetToken = crypto
		.createHash('sha256')
		.update(resetToken)
		.digest('hex');
	//expires in 10 minutes
	this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

	//return the unencrypted token
	return resetToken;
};

const Users = mongoose.model('Users', userSchema, 'users');

module.exports = Users;
