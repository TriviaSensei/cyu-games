const { v4: uuidV4 } = require('uuid');

class PushfightRules {
	getMatchId() {
		return this.matchId;
	}

	getGameState() {
		return { ...this.gameState };
	}

	getPlayers() {
		return this.gameState.players;
	}

	setGameState(data) {
		this.gameState = {
			...this.gameState,
			...data,
		};
	}

	addPlayer(user) {
		//see if the player is already in the game - if so, update their information (possibly a reconnect, so they'll need a new socket ID, etc.)
		let playerAdded = false;
		let playerUpdated = false;
		if (
			!this.gameState.players.some((p) => {
				if (p.user?.id === user.id) {
					playerUpdated = true;
					p.user.socketId = user.socketId;
					return true;
				}
			})
		) {
			//if not, add them
			if (
				!this.gameState.players.some((p) => {
					if (!p.user) {
						playerAdded = true;
						p.user = {
							id: user.id,
							socketId: user.socketId,
							name: user.name,
							rating: user.rating || 'Unr',
						};
						return true;
					}
				})
			) {
				//if there was no space, return nothing
				return {
					status: 'fail',
					message: 'This game is full.',
				};
			}
		}
		//we've added the player. if the game is now full, start it.
		if (
			playerAdded &&
			this.gameState.players.every((p) => {
				return p.user;
			})
		) {
			this.gameState.active = true;
			this.gameState.message = {
				status: 'info',
				message: 'Game starting...stand by...',
				duration: 3000,
			};
			this.gameState.status = 'pregame';
			this.gameState.statusMessage = 'Game starting...';
			if (this.settings.color === 'random') {
				const a = Math.random();
				if (a < 0.5) {
					this.gameState.players.unshift(this.gameState.players.pop());
				}
			}
		}

		return {
			playerAdded,
			playerUpdated,
			status: 'OK',
		};
	}
	constructor(settings) {
		console.log('Initializing game manager for Pushfight');
		let message = '';
		if (!['black', 'white', 'random'].includes(settings.color))
			message = 'Invalid color specified';
		else if (!['game', 'move', 'off'].includes(settings.timer))
			message = 'Invalid timer setting';
		else if (settings.timer === 'game') {
			if (settings.time < 5)
				message = 'Invalid game length - minimum is 5 minutes';
			else if (settings.increment < 0)
				message = 'Invalid increment length - must not be negative';
		} else if (settings.timer === 'move') {
			if (settings.time < 1)
				message = 'Invalid move timer length - minimum is 1 minute';
			else if (settings.reserve < 0)
				message = 'Invalid reserve length - must not be negative';
		}
		if (!message) {
			const timerState = {
				time: settings.timer === 'off' ? null : settings.time * 60 * 1000,
				increment: settings.timer === 'game' ? settings.increment * 1000 : 0,
				reserve: settings.timer === 'move' ? settings.reserve * 60 * 1000 : 0,
			};
			const boardState = [];
			for (var space = 0; space < 32; space++) {
				const newSpace = {
					piece: null,
					space,
					valid: true,
					up: space - 4 >= 0 ? space - 4 : -1,
					down: space + 4 <= 31 ? space + 4 : -1,
					left: space % 4 === 0 ? null : space - 1,
					right: space % 4 === 3 ? null : space + 1,
				};
				//handle cut out spaces - these can be pushed into, but not moved into
				//left edges
				if ([1, 25, 29].includes(space)) newSpace.left = -1;
				//right edges
				if ([2, 6, 30].includes(space)) newSpace.right = -1;
				//top edges
				if ([4, 11].includes(space)) newSpace.up = -1;
				//bottom edges
				if ([20, 27].includes(space)) newSpace.down = -1;
				//cut out spaces
				if ([0, 3, 7, 24, 28, 31].includes(space)) newSpace.valid = false;

				boardState.push(newSpace);
			}

			this.matchId = uuidV4();
			this.settings = { ...settings };
			this.host = settings.host;
			delete this.settings.host;
			this.gameState = {
				active: false,
				players: [
					{
						...timerState,
						timer: settings.timer,
						user: settings.color !== 'black' ? settings.host : null,
					},
					{
						...timerState,
						timer: settings.timer,
						user: settings.color === 'black' ? settings.host : null,
					},
				],
				settings: this.settings,
				host: settings.host,
				turnsCompleted: 0,
				moveList: [],
				boardState,
			};
		} else throw new Error(message);
	}
}

module.exports = PushfightRules;
