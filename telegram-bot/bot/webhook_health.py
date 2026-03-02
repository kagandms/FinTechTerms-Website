import tornado.web

class HealthCheckHandler(tornado.web.RequestHandler):
    def get(self):
        self.write({"status": "alive", "service": "Telegram Webhook"})
        self.set_status(200)

    # In case uptime robot sends HEAD requests
    def head(self):
        self.set_status(200)
