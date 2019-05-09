module.exports = function shellSanitize(input) {
	const evilCharacters = [';', '<', '>', '|', '?', '*', '[', ']', '$', '\\', '(', ')', '{', '}', '\'', '&&', '||', '&'];
	let ok = true;
	evilCharacters.forEach( (punk) => {
		if (input.includes(punk)) {
			ok = false;
		}
	});
	return ok;
};