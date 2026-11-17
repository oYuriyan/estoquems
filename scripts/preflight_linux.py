"""Conferencia de implantacao: somente leitura, sem iniciar containers ou migrar dados."""
import argparse
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
from urllib.parse import urlsplit, unquote


class PreflightError(Exception):
    pass


def validate_config(config):
    errors = []
    services = config.get('services', {})
    api = services.get('api', {})
    # O JSON serializado pelo Compose duplica $ para permitir reuso do arquivo.
    normalize = lambda values: {k: v.replace('$$', '$') if isinstance(v, str) else v for k, v in values.items()}
    env = normalize(api.get('environment', {}))
    db = services.get('db', {})
    db_env = normalize(db.get('environment', {}))
    if config.get('name') != 'estoque':
        errors.append('O projeto Compose deve se chamar estoque para manter os nomes dos volumes.')
    for key in ('DATABASE_URL', 'JWT_SECRET_KEY', 'FRONTEND_ORIGIN', 'PASSWORD_RESET_URL'):
        value = env.get(key)
        if not isinstance(value, str) or not value.strip():
            errors.append(f'Defina {key} no ambiente privado.')
        elif any(marker in value.lower() for marker in ('sua_senha', 'sua_chave', 'senha_forte', 'seu_ip', 'seu-dominio', 'change_me', 'changeme')):
            errors.append(f'Substitua o exemplo de {key} pela configuracao real.')
    for key in ('POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'):
        if not db_env.get(key):
            errors.append(f'Defina {key} no ambiente privado.')
    if len(env.get('JWT_SECRET_KEY') or '') < 32:
        errors.append('A chave JWT precisa ter pelo menos 32 caracteres; nao use a chave de exemplo.')
    database = urlsplit(env.get('DATABASE_URL') or '')
    if (database.scheme != 'postgresql+asyncpg' or database.hostname != 'db'
            or database.path.lstrip('/') != str(db_env.get('POSTGRES_DB') or '')
            or unquote(database.username or '') != str(db_env.get('POSTGRES_USER') or '')
            or unquote(database.password or '') != str(db_env.get('POSTGRES_PASSWORD') or '')):
        errors.append('DATABASE_URL deve apontar para o servico db e corresponder a POSTGRES_USER/PASSWORD/DB.')
    origin = urlsplit(env.get('FRONTEND_ORIGIN') or '')
    reset = urlsplit(env.get('PASSWORD_RESET_URL') or '')
    if origin.scheme != 'https' or not origin.hostname or origin.hostname in ('localhost', '127.0.0.1', '::1'):
        errors.append('FRONTEND_ORIGIN deve apontar para o endereco HTTPS da VM usado pela equipe.')
    if origin.path not in ('', '/') or origin.query or origin.fragment or origin.username or origin.password:
        errors.append('FRONTEND_ORIGIN deve conter apenas a origem HTTPS, sem caminho ou credenciais.')
    if reset.scheme != 'https' or reset.netloc != origin.netloc or reset.username or reset.password:
        errors.append('PASSWORD_RESET_URL deve usar a mesma origem HTTPS do piloto.')
    if origin.port not in (None, 443):
        errors.append('O Compose de producao publica HTTPS em 443; ajuste a origem para esse endereco.')
    for service in ('api', 'db'):
        if services.get(service, {}).get('ports'):
            errors.append(f'A porta de {service} nao deve ser publicada no host.')
    for port in services.get('n8n', {}).get('ports', []):
        if port.get('host_ip') not in ('127.0.0.1', '::1'):
            errors.append('A administracao do n8n deve estar restrita ao loopback.')
    published = {str(p.get('published')) for p in services.get('nginx', {}).get('ports', [])}
    if published != {'80', '443'}:
        errors.append('Confira as portas publicadas do Nginx: 80 e 443.')
    for service in ('db', 'nginx', 'n8n'):
        image = services.get(service, {}).get('image', '')
        if not re.fullmatch(r'.+@sha256:[a-fA-F0-9]{64}', image):
            errors.append(f'Fixe a imagem de {service} pelo digest validado antes da implantacao.')
    for name in ('postgres_data', 'n8n_data', 'catalog_data'):
        if config.get('volumes', {}).get(name, {}).get('name') != 'estoque_' + name:
            errors.append(f'Confira o volume persistente estoque_{name}.')
    return errors


def captured(args, *, cwd=None):
    result = subprocess.run(args, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        # Erros do Compose/OpenSSL podem conter configuracao privada; nao exibi-los.
        raise PreflightError(f'Falha ao executar {args[0]}; confira a configuracao local, sem publicar logs privados.')
    return result.stdout


def validate_certificate(cert, key, host):
    captured(['openssl', 'x509', '-in', str(cert), '-noout', '-checkend', '86400'])
    import ipaddress
    try:
        ipaddress.ip_address(host)
        option = '-verify_ip'
    except ValueError:
        option = '-verify_hostname'
    # Confere este certificado explicitamente; nao instala autoridades no host
    # nem comprova que os dispositivos dos usuarios confiam nessa autoridade.
    captured(['openssl', 'verify', '-partial_chain', '-trusted', str(cert), '-purpose', 'sslserver', option, host, str(cert)])
    public_cert = captured(['openssl', 'x509', '-in', str(cert), '-pubkey', '-noout']).strip()
    public_key = captured(['openssl', 'pkey', '-in', str(key), '-passin', 'pass:', '-pubout']).strip()
    if public_cert != public_key:
        raise PreflightError('O certificado e a chave privada nao correspondem.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project-dir', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--backup-dir', required=True, type=Path, help='Diretorio privado existente, fora do repositorio.')
    args = parser.parse_args()
    root = args.project_dir.resolve()
    if platform.system() != 'Linux':
        raise PreflightError('Execute esta conferencia na VM Linux de destino. Nenhum servico foi alterado.')
    for command in ('docker', 'openssl'):
        if shutil.which(command) is None:
            raise PreflightError(f'Instale {command} pelo procedimento da TI.')
    daemon = json.loads(captured(['docker', 'info', '--format', '{{json .}}']))
    if daemon.get('OSType') != 'linux':
        raise PreflightError('O daemon deve executar containers Linux.')
    if daemon.get('Architecture') not in ('x86_64', 'amd64'):
        raise PreflightError('As imagens validadas sao amd64; validar imagens compativeis antes de usar outra arquitetura.')
    captured(['docker', 'compose', 'version'])
    env_file = root / '.env'
    if not env_file.is_file() or env_file.stat().st_mode & 0o077:
        raise PreflightError('O arquivo .env privado deve existir com permissao 600.')
    config = json.loads(captured(['docker', 'compose', '--env-file', str(env_file), '-f', str(root / 'docker-compose.prod.yml'), 'config', '--format', 'json'], cwd=root))
    errors = validate_config(config)
    if errors:
        raise PreflightError('\n'.join(errors))
    cert, key = root / 'nginx/ssl/selfsigned.crt', root / 'nginx/ssl/selfsigned.key'
    if not cert.is_file() or not key.is_file() or key.stat().st_mode & 0o077:
        raise PreflightError('Instale certificado e chave correspondentes; a chave privada precisa de permissao 600.')
    host = urlsplit(config['services']['api']['environment']['FRONTEND_ORIGIN']).hostname
    validate_certificate(cert, key, host)
    if not (root / 'frontend/dist/index.html').is_file():
        raise PreflightError('Compile e instale o frontend em frontend/dist antes de iniciar o Nginx.')
    backup = args.backup_dir.resolve()
    if backup == root or root in backup.parents:
        raise PreflightError('O destino de backups deve ficar fora do repositorio.')
    if not backup.is_dir() or not os.access(backup, os.W_OK) or backup.stat().st_mode & 0o077:
        raise PreflightError('O destino de backups deve existir, ser gravavel e ter permissao privada (700).')
    warnings = ['Confianca do certificado nos dispositivos e regras reais de firewall ainda precisam de homologacao.']
    if backup.stat().st_dev == root.stat().st_dev:
        warnings.append('Backup no mesmo filesystem: confirmar replica em armazenamento independente.')
    print(json.dumps({'checks_passed': True, 'read_only': True, 'services_started': False, 'migrations_executed': False, 'warnings': warnings}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (PreflightError, ValueError, OSError) as error:
        # OSError aqui trata caminhos/comandos locais; nunca imprimir configuracao.
        print(str(error) if isinstance(error, PreflightError) else 'Falha na conferencia local; revise os pre-requisitos.', file=sys.stderr)
        sys.exit(1)
