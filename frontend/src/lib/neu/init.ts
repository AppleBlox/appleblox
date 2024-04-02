import authInfo from "@root/.tmp/auth_info.json"
if (import.meta.env.DEV) {
	try {
		// method 1
		const storedToken = sessionStorage.getItem('NL_TOKEN');
		if (storedToken) window.NL_TOKEN = storedToken;

		// method 2
		const {accessToken, port} = authInfo;
		window.NL_PORT = port;
		window.NL_TOKEN = accessToken;
	} catch (error) {
		console.log(error);
		console.error('Auth file not found, native API calls will not work.');
	}
}
