const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/signup', authController.isLoggedIn, authController.signup);
router.patch('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);
router.get('/getUser', authController.isLoggedIn, authController.getUser);
router.patch('/activate/:token', authController.activateAccount);

router.use(authController.protect);

router.patch('/changePassword', authController.updatePassword);
router.get('/:id', userController.getMe);

module.exports = router;
