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
// const userTimeout = 5 * 60 * 1000;
const userTimeout = 2000;
const pregameLength = 3000;

const { gameList, getGame } = require('../utils/gameList');

const gameManager = {
	pushfight: require('./games/pushfightSocket'),
	get10: require('./games/get10Manager'),
	cribbage: require('./games/cribbageManager'),
};

let io;

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
let availableGames = [];
let activeGames = [];

const disconnectUser = async (id) => {
	let game;
	connectedUsers = connectedUsers.filter((u) => {
		if (
			u.socketId !== id ||
			!u.lastDisconnect ||
			new Date() - Date.parse(u.lastDisconnect) < userTimeout
		)
			return true;

		console.log(`Disconnecting user with socket ID ${id}`);

		if (!u.matchId) return false;

		game = activeGames.find((g) => {
			return g.gameManager?.getMatchId() === u.matchId;
		});
		if (!game) return false;

		game.gameManager.removePlayer(id, 'disconnect');
		return false;
	});
};

const getUser = async (cookie) => {
	const arr = cookie.split(';');
	const token = arr.find((c) => {
		const t = c.split('=');
		if (t.length !== 2) return false;
		return t[0].trim() === 'jwt';
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

const getGameForUser = (id) => {
	let user = getConnectedUser(id);
	if (!user || !user.matchId) return null;
	let toReturn = activeGames.find((g) => {
		return g.gameManager.getMatchId() === user.matchId;
	});
	if (!toReturn)
		toReturn = availableGames.find((g) => {
			return g.gameManager.getMatchId() === user.matchId;
		});
	return toReturn;
};

const removeGame = (id) => {
	connectedUsers.forEach((u) => {
		if (u.matchId === id) u.matchId = null;
	});

	activeGames = activeGames.filter((g) => {
		return g.gameManager.getMatchId() !== id;
	});
};

const socket = async (http, server) => {
	io = require('socket.io')(http, {
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

		const forceDisconnect = (user) => {
			const socketToDisconnect = io.sockets.sockets.get(user.socketId);
			if (!socketToDisconnect) return;
			if (user.gameId) socketToDisconnect.leave(user.gameId);
			if (user.matchId) socketToDisconnect.leave(user.matchId);
			io.to(user.socketId).emit('force-disconnect', null);
		};

		const setUserData = (data) => {
			if ((typeof data).toLowerCase() !== 'object') return;
			const items = Object.getOwnPropertyNames(data);
			if (
				!connectedUsers.some((u) => {
					if (u.id === loggedInUser.id) {
						items.forEach((i) => {
							if (i === 'socketId') forceDisconnect(u);
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
				console.log(availableGames);
				io.to(socket.id).emit(
					'available-games-list',
					availableGames
						.filter((g) => {
							return (
								g.game === last && g.gameManager.host.id !== loggedInUser.id
							);
						})
						.map((g) => {
							return {
								...g,
								matchId: g.gameManager.getMatchId(),
								gameManager: null,
							};
						})
				);
			}
		}

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
			console.log(user);
			//when a player is actually added (instead of rejoining), send the update to the whole game
			if (result.playerAdded) {
				console.log(`${user.name} is joining game ${matchId}`);
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
			//if the game started, put it in the active games list, and remove it from the availableGames list.
			if (result.gameStarted) {
				//move the game to activeGames
				const game = availableGames.find((g) => {
					return g.gameManager.getMatchId() === matchId;
				});
				if (!game)
					return io.to(matchId).emit('server-message', {
						status: 'error',
						message: 'Something went wrong.',
					});
				activeGames.push(game);

				//remove the game from availableGames, tell the lobby that the game is no longer available
				availableGames = availableGames.filter((g) => {
					return g.gameManager.getMatchId() !== matchId;
				});
				io.to(user.gameId).emit('cancel-game', { id: matchId });
			}
		};
		//see if the user is part of an active game
		const isInGame = (g) => {
			const user = getConnectedUser(socket.id);
			if (g.gameManager.gameName !== user.gameId) return false;
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

			const user = getConnectedUser(socket.id);
			if (!user)
				return cb({
					status: 'fail',
					message: 'You are not connected',
				});

			cb({
				status: 'OK',
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
			if (!user)
				return cb({
					status: 'fail',
					message: 'User not found. Try logging in again.',
				});
			if (user.matchId) {
				return cb({ status: 'fail', message: 'You are already in a game.' });
			}

			myRating = user.rating;

			const newGame = {
				...data,
				host: {
					name: user.name,
					id: user.id,
					socketId: user.socketId,
					rating: myRating ? myRating.rating : 1200,
				},
			};
			try {
				const gm = new gameManager[user.gameId](newGame, io);
				availableGames.push({
					...newGame,
					gameManager: gm,
				});
				socket.to(user.gameId).emit('available-new-game', {
					...newGame,
					matchId: gm.getMatchId(),
				});

				socket.join(gm.getMatchId());

				cb({ status: 'OK' });
				setUserData({ matchId: gm.getMatchId() });
				gm.sendGameUpdate();
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
			const result = await game.gameManager.playMove({
				user,
				...data,
			});
			cb(result);
		});

		socket.on('request-exit', (data, cb) => {
			const user = getConnectedUser(socket.id);
			if (!user) return cb({ status: 'fail', message: 'User not found' });

			const game = activeGames.find((g) => {
				return g.gameManager.getMatchId() === user.matchId;
			});

			if (!game) return cb({ status: 'OK' });

			const gameState = game.gameManager.getGameState();
			if (gameState.status !== 'ended')
				return cb({ status: 'fail', message: 'This game is still active.' });

			const result = game.gameManager.requestPlayerDrop(user.id);

			if (result.status !== 'OK') return cb(result);

			socket.leave(user.matchId);
			socket.to(user.matchId).emit('user-exit', {
				name: user.name,
			});
			setUserData({ matchId: null });

			if (result.toDelete) removeGame(user.matchId);

			return cb({ status: 'OK' });
		});

		socket.on('request-rematch', (data, cb) => {
			const user = getConnectedUser(socket.id);
			if (!user) return cb({ status: 'fail', message: 'User not found' });

			const game = activeGames.find((g) => {
				return g.gameManager.getMatchId() === user.matchId;
			});
			if (!game)
				return cb({ status: 'fail', message: 'Rematch request failed' });

			const result = game.gameManager.requestRematch(user.id);
			cb(result);
			if (result.status === 'OK')
				socket
					.to(user.matchId)
					.emit('rematch-request', { players: result.players });
		});

		socket.on('disconnect', (reason) => {
			console.log(`${loggedInUser.displayName} has disconnected (${reason})`);
			setUserData({ lastDisconnect: new Date() });
			const user = getUser(socket.id);
			const game = getGameForUser(socket.id);
			if (game) {
				game.gameManager.setPlayerData(user.id, { connected: false });
			}
			setTimeout(() => {
				disconnectUser(socket.id);
			}, userTimeout);
		});
	});
};

module.exports = socket;
