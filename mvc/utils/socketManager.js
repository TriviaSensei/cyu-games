// If user disconnects, their games get resigned in 3 minutes
// const userTimeout = 3 * 60 * 1000;
// const userTimeout = 2000;
const { promisify } = require('util');
const { v4: uuidV4 } = require('uuid');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Filter = require('bad-words');
const filter = new Filter();

const pingInterval = 1000;
const pingTimeout = 500;
const userTimeout = 5 * 60 * 1000;

const { gameList, getGame } = require('../utils/gameList');

const verifyGameData = require('./games/_verifyGameData');
const { disconnect } = require('process');

const gameSockets = {
	pushfight: require('./games/pushfightSocket'),
};

/**
 * {
 * 		id: asfasfasfs
 * 		name: Chuck,
 * 		socketId: afjwkejfwlkjfe-131
 * 		gameId: 'pushfight',
 * 		matchId: 'asfasd-13125-g12-hsdjkfhk23',
 * }
 */
let connectedUsers = [];
let availableGames = [
	{
		game: 'pushfight',
		color: 'random',
		timer: 'game',
		time: 5,
		increment: 30,
		reserve: 10,
		matchId: '357b7c68-6bca-47ec-b4ea-84ff49c7df0a',
		gameState: {
			active: false,
			timer: 'game',
			players: [
				{
					time: 300000,
					increment: 30000,
					reserve: 0,
					id: null,
					name: null,
					rating: null,
				},
				{
					time: 300000,
					increment: 30000,
					reserve: 0,
					id: null,
					name: null,
					rating: null,
				},
			],
			turnsCompleted: 0,
			moveList: [],
			boardState: [
				{
					piece: null,
					space: 0,
					valid: false,
					up: -1,
					down: 4,
					left: null,
					right: 1,
				},
				{
					piece: null,
					space: 1,
					valid: true,
					up: -1,
					down: 5,
					left: -1,
					right: 2,
				},
				{
					piece: null,
					space: 2,
					valid: true,
					up: -1,
					down: 6,
					left: 1,
					right: -1,
				},
				{
					piece: null,
					space: 3,
					valid: false,
					up: -1,
					down: 7,
					left: 2,
					right: null,
				},
				{
					piece: null,
					space: 4,
					valid: true,
					up: -1,
					down: 8,
					left: null,
					right: 5,
				},
				{
					piece: null,
					space: 5,
					valid: true,
					up: 1,
					down: 9,
					left: 4,
					right: 6,
				},
				{
					piece: null,
					space: 6,
					valid: true,
					up: 2,
					down: 10,
					left: 5,
					right: -1,
				},
				{
					piece: null,
					space: 7,
					valid: false,
					up: 3,
					down: 11,
					left: 6,
					right: null,
				},
				{
					piece: null,
					space: 8,
					valid: true,
					up: 4,
					down: 12,
					left: null,
					right: 9,
				},
				{
					piece: null,
					space: 9,
					valid: true,
					up: 5,
					down: 13,
					left: 8,
					right: 10,
				},
				{
					piece: null,
					space: 10,
					valid: true,
					up: 6,
					down: 14,
					left: 9,
					right: 11,
				},
				{
					piece: null,
					space: 11,
					valid: true,
					up: -1,
					down: 15,
					left: 10,
					right: null,
				},
				{
					piece: null,
					space: 12,
					valid: true,
					up: 8,
					down: 16,
					left: null,
					right: 13,
				},
				{
					piece: null,
					space: 13,
					valid: true,
					up: 9,
					down: 17,
					left: 12,
					right: 14,
				},
				{
					piece: null,
					space: 14,
					valid: true,
					up: 10,
					down: 18,
					left: 13,
					right: 15,
				},
				{
					piece: null,
					space: 15,
					valid: true,
					up: 11,
					down: 19,
					left: 14,
					right: null,
				},
				{
					piece: null,
					space: 16,
					valid: true,
					up: 12,
					down: 20,
					left: null,
					right: 17,
				},
				{
					piece: null,
					space: 17,
					valid: true,
					up: 13,
					down: 21,
					left: 16,
					right: 18,
				},
				{
					piece: null,
					space: 18,
					valid: true,
					up: 14,
					down: 22,
					left: 17,
					right: 19,
				},
				{
					piece: null,
					space: 19,
					valid: true,
					up: 15,
					down: 23,
					left: 18,
					right: null,
				},
				{
					piece: null,
					space: 20,
					valid: true,
					up: 16,
					down: -1,
					left: null,
					right: 21,
				},
				{
					piece: null,
					space: 21,
					valid: true,
					up: 17,
					down: 25,
					left: 20,
					right: 22,
				},
				{
					piece: null,
					space: 22,
					valid: true,
					up: 18,
					down: 26,
					left: 21,
					right: 23,
				},
				{
					piece: null,
					space: 23,
					valid: true,
					up: 19,
					down: 27,
					left: 22,
					right: null,
				},
				{
					piece: null,
					space: 24,
					valid: false,
					up: 20,
					down: 28,
					left: null,
					right: 25,
				},
				{
					piece: null,
					space: 25,
					valid: true,
					up: 21,
					down: 29,
					left: -1,
					right: 26,
				},
				{
					piece: null,
					space: 26,
					valid: true,
					up: 22,
					down: 30,
					left: 25,
					right: 27,
				},
				{
					piece: null,
					space: 27,
					valid: true,
					up: 23,
					down: -1,
					left: 26,
					right: null,
				},
				{
					piece: null,
					space: 28,
					valid: false,
					up: 24,
					down: -1,
					left: null,
					right: 29,
				},
				{
					piece: null,
					space: 29,
					valid: true,
					up: 25,
					down: -1,
					left: -1,
					right: 30,
				},
				{
					piece: null,
					space: 30,
					valid: true,
					up: 26,
					down: -1,
					left: 29,
					right: -1,
				},
				{
					piece: null,
					space: 31,
					valid: false,
					up: 27,
					down: -1,
					left: 30,
					right: null,
				},
			],
		},
		status: 'OK',
		host: {
			id: '667cb17b0a7be772a5b2220e',
			user: 'Chuck',
			rating: 'Unr',
		},
	},
];
// availableGames = [];
let activeGames = [];

const disconnectUser = (id) => {
	connectedUsers = connectedUsers.filter((u) => {
		return (
			u.socketId !== id ||
			!u.lastDisconnect ||
			new Date() - Date.parse(u.lastDisconnect) < userTimeout
		);
	});
};

const getUser = async (cookie) => {
	const arr = cookie.split(';');
	const token = arr.find((c) => {
		const t = c.split('=');
		if (t.length !== 2) return false;
		return t[0] === 'jwt';
	});
	if (!token) return null;
	const decoded = await promisify(jwt.verify)(
		token.split('=')[1],
		process.env.JWT_SECRET
	);
	if (!decoded) return null;
	const user = await User.findById(decoded.id);
	user.email = '';
	return user;
};

const getConnectedUser = (id) => {
	return connectedUsers.find((u) => {
		return u.socketId === id;
	});
};

const socket = async (http, server) => {
	const io = require('socket.io')(http, {
		pingInterval,
		pingTimeout,
	});
	io.listen(server);

	io.on('connection', async (socket) => {
		//get the user
		const loggedInUser = await getUser(socket.handshake.headers.cookie);
		console.log(
			`A user (${loggedInUser.displayName}) has connected from ${socket.handshake.address} with socket ID ${socket.id}`
		);

		//which room are we joining?
		const arr = socket.handshake.headers.referer.split('/');
		let last;
		while (!last) {
			last = arr.pop().toLowerCase();
		}

		const setUserData = (data) => {
			if ((typeof data).toLowerCase() !== 'object') return;
			const items = Object.getOwnPropertyNames(data);
			if (
				!connectedUsers.some((u) => {
					if (u.id === loggedInUser.id) {
						items.forEach((i) => {
							u[i] = data[i];
						});
						return true;
					}
				})
			) {
				connectedUsers.push({
					...data,
					id: loggedInUser.id,
					name: loggedInUser.displayName,
					rating: loggedInUser.ratings.find((r) => {
						return r.game === last;
					}),
				});
			}
		};
		//add the user to the connected users if they're not already there
		setUserData({ socketId: socket.id, lastDisconnect: null });

		const joinGame = (game) => {
			setUserData({ matchId: game.matchId });
			socket.join(game.matchId);
			io.to(socket.id).emit('update-game-state', game.gameState);
		};
		//see if the user is part of an active game
		const isInGame = (g) => {
			return (
				g.host.id === loggedInUser.id ||
				g.gameState.players.some((p) => {
					return p.id === loggedInUser.id;
				})
			);
		};
		let currentGame = activeGames.find(isInGame);
		//else see if they were searching for one and disconnected and reconnected
		if (!currentGame) currentGame = availableGames.find(isInGame);

		if (currentGame) joinGame(currentGame);

		const roomData = gameList.map((c) => {
			return {
				...c,
				games: c.games.map((g) => {
					const room = io.sockets.adapter.rooms.get(g.name.toLowerCase());
					return {
						...g,
						size: room ? room.size : 0,
					};
				}),
			};
		});

		//main lobby - just send the room data to the user
		if (last === 'play') io.to(socket.id).emit('game-list', roomData);
		//otherwise, see if we're playing a valid game. If so, join the lobby for that game to get chat messages and see available matches
		else {
			if (
				gameList.some((c) => {
					return c.games.some((g) => {
						return g.name.toLowerCase() === last.toLowerCase();
					});
				})
			) {
				console.log(`${loggedInUser.displayName} is joining ${last}`);
				setUserData({ gameId: last });
				socket.join(last);
				io.to(last).emit('chat-message-lobby', {
					user: 'system',
					message: `${loggedInUser.displayName} has entered the lobby.`,
				});
				//set up a socket handler with the rules of this specific game
				if (gameSockets[last]) gameSockets[last](socket);

				//send the list of available games in the lobby to the newly connected user
				io.to(socket.id).emit(
					'available-games-list',
					availableGames.filter((g) => {
						return g.game === last && g.host.user !== loggedInUser.displayName;
					})
				);
			}
		}

		socket.on('chat-message', (data, cb) => {
			if (filter.isProfane(data.message))
				return cb({
					status: 'fail',
					message: 'Please watch your language.',
				});
			cb({
				status: 'OK',
			});
			const user = getConnectedUser(socket.id);
			console.log({
				...user,
				...data,
			});
			if (user.matchId)
				socket.to(user.matchId).emit('chat-message-match', {
					user: user.name,
					message: data.message,
				});
			else if (user.gameId)
				socket.to(user.gameId).emit('chat-message-lobby', {
					user: user.name,
					message: data.message,
				});
		});

		socket.on('create-game', (data, cb) => {
			//is this person playing a game or already waiting for one?
			const user = getConnectedUser(socket.id);
			if (user.matchId) {
				return cb({ status: 'fail', message: 'You are already in a game.' });
			}

			const toReturn = verifyGameData(data, user);

			if (toReturn.status === 'OK') {
				myRating = loggedInUser.ratings.find((r) => {
					return r.game === data.game;
				});
				const matchId = uuidV4();
				setUserData({ matchId });
				const newGame = {
					...toReturn,
					host: {
						id: user.id,
						user: user.name,
						rating: myRating
							? myRating.games > 20
								? myRating.rating
								: `${myRating.rating}P${myRating.games}`
							: 'Unr',
					},
				};
				availableGames.push(newGame);

				socket.to(user.gameId).emit('available-new-game', newGame);
				cb({ status: 'OK' });
				return io.to(socket.id).emit('update-game-state', toReturn.gameState);
			}
		});

		socket.on('cancel-game', (data, cb) => {
			const user = getConnectedUser(socket.id);
			if (!user.matchId)
				return cb({ status: 'fail', message: 'No game found.' });

			socket.to(user.gameId).emit('cancel-game', { id: user.matchId });

			availableGames = availableGames.filter((g) => {
				return g.matchId !== user.matchId;
			});

			setUserData({ matchId: '' });

			cb({ status: 'OK' });
		});

		socket.on('join-game', (data, cb) => {
			const gameToJoin = availableGames.find((g) => {
				return g.matchId === data.matchId;
			});
			if (!gameToJoin) return cb({ status: 'fail', message: 'Game not found' });
			cb({ status: 'OK' });
			joinGame(gameToJoin);
		});

		socket.on('disconnect', (reason) => {
			console.log(`${loggedInUser.displayName} has disconnected (${reason})`);
			setUserData({ lastDisconnect: new Date() });
			setTimeout(() => {
				disconnectUser(socket.id);
			}, userTimeout);
		});
	});
};
module.exports = socket;
