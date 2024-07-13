const express = require('express');
const authController = require('../controllers/authController');
const viewController = require('../controllers/viewController');
const router = express.Router();

router.get('/', authController.isLoggedIn, viewController.getHome);
router.get('/signup', authController.isLoggedIn, viewController.getSignup);
router.get(
	'/activate/:token',
	authController.isLoggedIn,
	viewController.getActivation
);
router.use(authController.protect);
router.get('/play', viewController.getPlay);
router.get('/play/:gameName', viewController.getGame);
// router.get('/:game', viewController.getHome);
module.exports = router;
