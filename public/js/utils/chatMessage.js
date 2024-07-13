import { createElement } from './createElementFromSelector.js';

export const createChatMessage = (sender, message) => {
	const toReturn = createElement('.chat-message');
	if (sender === 'system') {
		toReturn.classList.add('system-message');
		toReturn.innerHTML = message;
		return toReturn;
	} else if (sender === 'me') toReturn.classList.add('from-me');

	const s = createElement('.sender');
	s.innerHTML = sender === 'me' ? 'Me' : sender;
	toReturn.appendChild(s);

	const msg = createElement('.chat-bubble');
	msg.innerHTML = message;
	toReturn.appendChild(msg);
	return toReturn;
};
