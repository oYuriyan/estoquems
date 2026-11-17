"""SMTP with verified STARTTLS; secrets and reset URLs never enter logs."""
import logging
import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import urlsplit
from app.core.config import get_settings

def mail_ready():
    s = get_settings()
    url = urlsplit(s.PASSWORD_RESET_URL)
    return bool(s.SMTP_USERNAME and s.SMTP_PASSWORD and s.SMTP_FROM and url.scheme == 'https' and url.netloc and not url.fragment and not url.query)

def send_reset_email(recipient, token):
    s = get_settings()
    message = EmailMessage()
    message['Subject'] = 'Lummium — recuperação de senha'
    message['From'] = s.SMTP_FROM
    message['To'] = recipient
    message.set_content('Recebemos uma solicitação para redefinir sua senha. O link expira em 15 minutos e só pode ser usado uma vez.\n\n'
                        + s.PASSWORD_RESET_URL + '#reset=' + token
                        + '\n\nSe você não solicitou, ignore este e-mail. Sua senha permanece a mesma.')
    try:
        with smtplib.SMTP(s.SMTP_HOST, s.SMTP_PORT, timeout=15) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            smtp.login(s.SMTP_USERNAME, s.SMTP_PASSWORD)
            smtp.send_message(message)
    except Exception:
        logging.getLogger(__name__).error('Falha no envio SMTP de recuperação; verificar configuração e conectividade.')
