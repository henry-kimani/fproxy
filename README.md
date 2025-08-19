# FPROXY

Fproxy is an electron app, which acts a proxy server for Meta Trader 4 and Ftrade.
Ftrade is a trading journal for Meta Trader 4, therefore, to get the data out
of Meta Trader to Ftrade required a proxy. 

Since the extension I used, [MTSocketAPI](https://mtsocketapi.com), created a 
local TCP server and Ftrade being a Web App could not connect to TCP because the
browser don't expose API's to connect to TCP only HTTP due to security reasons.

So, Fproxy sits between MTSocketAPI (MetaTrader 4) and Ftrade. It listens to 
MTSocketAPI TCP server and broadcasts HTTP endpoints that Ftrade can use.

However, to use the HTTP endpoints you need to have the API_KEY and a SESSION_KEY
for security. The session key is created by Fproxy everytime you open the app and
the API_KEY is an env variable. Therefore, the API_KEY is static and the SESSION_KEY
is dynamic and both must be included in the HTTP req. 

The API_KEY in the Authorization Bearer header and the SESSION_KEY key in a 
custom header "x-session-header".
