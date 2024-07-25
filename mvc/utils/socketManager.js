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
const pregameLength = 3000;

const { gameList, getGame } = require('../utils/gameList');

const gameManager = {
	pushfight: require('./games/pushfightSocket'),
	get10: require('./games/get10Manager'),
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
const mgr = new gameManager['get10']({
	go: 'random',
	timer: 'move',
	time: 0.1,
	increment: 30,
	reserve: 0,
	host: {
		id: '667cb17b0a7be772a5b2220e',
		name: 'Chuck',
		rating: 'Unr',
	},
});

/**
 * game: 'pushfight', 'cribabge', etc.
 * gameManager: [GAMENAME]Rules {
 * 		gameState: {
 * 			active: bool,
 * 			...settings,
 *
 * 			players: [...],
 * 			...other info, game state, etc.
 * 		},
 * 		matchId: alkjsdlfjk=-187ghkjh34-gjh23kjhr
 *  	host: {
 *	 			id: alksdjjg34gj,
 * 				user: Chuck,
 * 				rating: 1200 (all from DB)
 * 		},
 * }
 *
 *
 *
 */
let availableGames = [
	{
		game: 'get10',
		gameManager: mgr,
	},
];

// availableGames = [];

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

				//send the list of available games in the lobby to the newly connected user
				io.to(socket.id).emit(
					'available-games-list',
					availableGames.filter((g) => {
						return g.game === last && g.gameManager.host.id !== loggedInUser.id;
					})
				);
			}
		}

		const sendGameUpdate = (gameState) => {
			gameState.players.forEach((p, i) => {
				if (!p.user) return;
				io.to(p.user.socketId).emit('update-game-state', {
					...gameState,
					myIndex: i,
				});
			});
		};

		const joinGame = (game) => {
			const matchId = game.gameManager.getMatchId();
			const user = getConnectedUser(socket.id);
			const result = game.gameManager.addPlayer(user);
			if (result.status !== 'OK')
				return io.to(socket.id).emit('message', {
					status: 'error',
					message: result.message,
				});
			setUserData({ matchId });
			socket.join(matchId);
			//when a player is actually added (instead of rejoining), send the update to the whole game
			const gameState = game.gameManager.getGameState();
			if (result.playerAdded) {
				console.log(`${user.name} is joining game ${matchId}`);
				sendGameUpdate(gameState);
				//game automatically starts when enough players join
				if (gameState.status === 'pregame') {
					io.to(user.gameId).emit('cancel-game', { id: matchId });
					activeGames.push(game);
					availableGames = availableGames.filter((g) => {
						return g.gameManager.getMatchId() !== matchId;
					});
					setTimeout(() => {
						game.gameManager.setGameState({
							status: 'playing',
							message: null,
							turnStart: Date.now(),
						});
						const gs = game.gameManager.getGameState();
						sendGameUpdate(gs);
					}, pregameLength);
				}
			}
			//otherwise, send it to just the player who rejoined
			else {
				console.log(`${user.name} is rejoining game ${matchId}`);
				const data = game.gameManager.refreshGameState();
				io.to(socket.id).emit('update-game-state', {
					...data,
					myIndex: data.players.findIndex((p) => {
						return p.user.id === user.id;
					}),
				});
			}
		};
		//see if the user is part of an active game
		const isInGame = (g) => {
			return (
				g.gameManager.host.id === loggedInUser.id ||
				g.gameManager.getGameState().players.some((p) => {
					return p.user?.id === loggedInUser.id;
				})
			);
		};
		let currentGame = activeGames.find(isInGame);
		//else see if they were searching for one and disconnected and reconnected
		if (!currentGame) currentGame = availableGames.find(isInGame);

		if (currentGame) joinGame(currentGame);

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
			console.log('creating game');
			//is this person playing a game or already waiting for one?
			const user = getConnectedUser(socket.id);
			if (!user)
				return cb({
					status: 'fail',
					message: 'User not found. Try logging in again.',
				});
			if (user.matchId) {
				return cb({ status: 'fail', message: 'You are already in a game.' });
			}

			myRating = loggedInUser.ratings.find((r) => {
				return r.game === data.game;
			});

			const newGame = {
				...data,
				host: {
					name: user.name,
					id: user.id,
					rating: myRating
						? myRating.games > 20
							? myRating.rating
							: `${myRating.rating}P${myRating.games}`
						: 'Unr',
				},
			};
			try {
				const gm = new gameManager[user.gameId](newGame);
				availableGames.push({
					...newGame,
					gameManager: gm,
				});
				socket.to(user.gameId).emit('available-new-game', gm);
				socket.join(gm.getMatchId());
				cb({ status: 'OK' });
				setUserData({ matchId: gm.getMatchId() });
				const gs = gm.getGameState();
				return io.to(socket.id).emit('update-game-state', {
					...gs,
					myIndex: gs.players.findIndex((p) => {
						return p.id === user.id;
					}),
				});
			} catch (err) {
				console.log(err);
				cb({
					status: 'fail',
					message: err.message,
				});
			}
		});

		socket.on('cancel-game', (data, cb) => {
			const user = getConnectedUser(socket.id);
			console.log(`canceling ${user.matchId}`);

			if (!user.matchId)
				return cb({ status: 'fail', message: 'No game found.' });

			let message = '';
			let gameDeleted = false;
			availableGames = availableGames.filter((g) => {
				if (g.gameManager.matchId !== user.matchId) return true;
				if (g.gameManager.host.id !== user.id) {
					message = 'You are not the host of this game and cannot cancel it.';
					return true;
				}
				gameDeleted = true;
				return false;
			});

			if (!gameDeleted) {
				return cb({
					status: 'fail',
					message: 'Something went wrong. No game was deleted.',
				});
			} else if (message) {
				return cb({ status: 'fail', message });
			}
			socket.to(user.gameId).emit('cancel-game', { id: user.matchId });
			io.to(socket.id).emit('update-game-state', null);
			setUserData({ matchId: '' });

			cb({ status: 'OK' });
		});

		socket.on('join-game', (data, cb) => {
			const gameToJoin = availableGames.find((g) => {
				return g.gameManager.getMatchId() === data.matchId;
			});
			if (!gameToJoin) return cb({ status: 'fail', message: 'Game not found' });
			cb({ status: 'OK' });
			joinGame(gameToJoin);
		});

		const updateRatings = async (game, result) => {
			const players = await Promise.all(
				result.gameState.ranking.map((p) => {
					return User.findById(p.user.id);
				})
			);

			await Promise.all(
				players.map((p) => {
					const rating = p.ratings.find((r) => {
						return r.game === game.game;
					});
					if (!rating) {
						p.ratings.push({
							game: game.game,
							rating: 1200,
							games: 0,
						});
						return p.save({
							validateBeforeSave: false,
						});
					} else {
						return p;
					}
				})
			);

			const ratingChanges = players.map((p, i) => {
				const r = p.ratings.find((g) => {
					return g.game === game.game;
				});

				return {
					rank: result.gameState.ranking[i].rank,
					oldRating: r.rating || 1200,
					newRating: r.rating || 1200,
					games: r.games,
				};
			});

			ratingChanges.forEach((p1, i) => {
				let ratingChange = 0;
				const K = p1.games < 20 ? 32 : p1.games < 100 ? 16 : 8;
				ratingChanges.forEach((p2, j) => {
					if (i === j) return;
					//result: 1 for win, 0 for loss, 0.5 for draw
					const result = p1.rank < p2.rank ? 1 : p1.rank === p2.rank ? 0.5 : 0;
					const pWin =
						1 / (1 + Math.pow(10, (p1.oldRating - p2.oldRating) / 400));
					ratingChange = ratingChange + K * (result - pWin);
				});
				p1.newRating = Math.max(100, p1.oldRating + Math.round(ratingChange));
			});
			result.gameState.ranking.forEach((r, i) => {
				r.oldRating = ratingChanges[i].oldRating;
				r.newRating = ratingChanges[i].newRating;
			});
			await Promise.all(
				result.gameState.ranking.map(async (r) => {
					const user = await User.findById(r.user.id);
					if (!user) return;
					user.ratings.some((g) => {
						if (g.game === game.game) {
							g.rating = r.newRating;
							g.games = g.games + 1;
							return true;
						}
					});
					//update their rating in the array as well
					connectedUsers.some((u) => {
						if (u.id === user._id.toString()) {
							u.rating.rating = r.newRating;
							u.rating.games++;
							return true;
						}
					});
					user.markModified('ratings');
					return user.save({ validateBeforeSave: false });
				})
			);
		};

		const handleEndGame = async (game, result) => {
			console.log(result);

			await updateRatings(game, result);

			result.gameState.players.forEach((p) => {
				const user = getConnectedUser(p.user.socketId);
				user.matchId = null;
			});

			activeGames = activeGames.filter((g) => {
				return g.gameManager.getMatchId() !== game.gameManager.getMatchId();
			});
		};

		socket.on('play-move', async (data, cb) => {
			const user = getConnectedUser(socket.id);
			if (!user) return cb({ status: 'fail', message: 'User not found.' });
			if (!user.matchId)
				return cb({ status: 'fail', message: 'You are not in a game.' });
			const game = activeGames.find((g) => {
				return g.gameManager.getMatchId() === user.matchId;
			});
			if (!game)
				return cb({ status: 'fail', message: 'Game not found or not active' });
			else {
				const state = game.gameManager.getGameState();
				if (state.status === 'ended')
					return cb({ status: 'fail', message: 'This game has ended' });
			}
			const result = game.gameManager.playMove({
				user,
				...data,
			});

			cb(result);

			if (result.status === 'OK') {
				if (game.timeout) {
					clearTimeout(game.timeout);
				}
				if (result.gameState.status === 'ended') {
					await handleEndGame(game, result);
				} else {
					const turn = game.gameManager.getTurn(result.gameState);
					if (result.gameState.timeout >= 0) {
						game.timeout = setTimeout(async () => {
							const timeoutResult = game.gameManager.removePlayer(
								turn,
								'timeout'
							);
							if (timeoutResult.gameState.status === 'ended')
								await handleEndGame(game, timeoutResult);
							sendGameUpdate(timeoutResult.gameState);
						}, result.gameState.timeout);
					}
				}
				sendGameUpdate(result.gameState);
			}
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
