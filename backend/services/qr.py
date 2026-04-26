import secrets


def generate_qr_token(prefix):
    random_part = secrets.token_urlsafe(18).replace('-', '').replace('_', '')[:20]
    return f'{prefix}-{random_part}'.upper()