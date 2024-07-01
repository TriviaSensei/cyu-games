// If user disconnects, their games get resigned in 3 minutes
// const userTimeout = 3 * 60 * 1000;
// const userTimeout = 2000;

const pingInterval = 1000;
const pingTimeout = 500;

const roomList = [
	{
		name: 'PushFight',
		url: '/pushfight',
	},
];

const socket = (http, server) => {
	const io = require('socket.io')(http, {
		pingInterval,
		pingTimeout,
	});
	io.listen(server);

	io.on('connection', (socket) => {
		console.log(`A user has connected from ${socket.handshake.address}`);
		// const rooms = Array.from(io.sockets.adapter.rooms.keys(), (x) => x).map;
		// console.log(rooms);
		const rooms = roomList.map((r) => {
			const room = io.sockets.adapter.rooms.get(r.name.toLowerCase);
			return {
				...r,
				size: room ? room.size : 0,
			};
		});
	});
};
module.exports = socket;
