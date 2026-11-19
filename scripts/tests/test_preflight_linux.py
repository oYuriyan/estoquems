import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

path = Path(__file__).resolve().parents[1] / 'preflight_linux.py'
spec = importlib.util.spec_from_file_location('preflight_linux', path)
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


def valid_config():
    return {
        'name': 'estoque',
        'services': {
            'api': {'environment': {
                'DATABASE_URL': 'postgresql+asyncpg://pilot:isolated-test-password@db:5432/pilot',
                'JWT_SECRET_KEY': 'isolated-deployment-test-key-0000000000',
                'FRONTEND_ORIGIN': 'https://pilot.example.invalid',
                'PASSWORD_RESET_URL': 'https://pilot.example.invalid/',
            }},
            'db': {'image': 'postgres@sha256:' + 'a' * 64, 'environment': {'POSTGRES_USER': 'pilot', 'POSTGRES_PASSWORD': 'isolated-test-password', 'POSTGRES_DB': 'pilot'}},
            'nginx': {'image': 'nginx@sha256:' + 'b' * 64, 'ports': [{'published': '80'}, {'published': '443'}]},
            'n8n': {'image': 'n8nio/n8n@sha256:' + 'c' * 64, 'ports': [{'host_ip': '127.0.0.1', 'published': '5678'}]},
        },
        'volumes': {name: {'name': 'estoque_' + name} for name in ('postgres_data', 'n8n_data', 'catalog_data')},
    }


class ConfigurationTests(unittest.TestCase):
    def test_valid_private_configuration(self):
        self.assertEqual(preflight.validate_config(valid_config()), [])

    def test_rejects_exposed_database_api_and_n8n(self):
        config = valid_config()
        config['services']['db']['ports'] = [{'published': '5432'}]
        config['services']['api']['ports'] = [{'published': '8000'}]
        config['services']['n8n']['ports'][0]['host_ip'] = '0.0.0.0'
        errors = preflight.validate_config(config)
        self.assertTrue(any('db' in e for e in errors))
        self.assertTrue(any('api' in e for e in errors))
        self.assertTrue(any('loopback' in e for e in errors))

    def test_rejects_reset_to_localhost_or_another_host(self):
        for url in ('https://localhost:3443/', 'http://pilot.example.invalid/', 'https://other.example.invalid/'):
            with self.subTest(url=url):
                config = valid_config()
                config['services']['api']['environment']['PASSWORD_RESET_URL'] = url
                self.assertTrue(any('PASSWORD_RESET_URL' in e for e in preflight.validate_config(config)))

    def test_rejects_wrong_project_volume_and_floating_image(self):
        config = valid_config()
        config['name'] = 'other'
        config['volumes']['postgres_data']['name'] = 'other_postgres_data'
        config['services']['n8n']['image'] = 'n8nio/n8n:latest'
        errors = preflight.validate_config(config)
        self.assertTrue(any('projeto' in e for e in errors))
        self.assertTrue(any('estoque_postgres_data' in e for e in errors))
        self.assertTrue(any('digest' in e for e in errors))

    def test_rejects_mismatched_database_credentials_without_echoing_them(self):
        config = valid_config()
        config['services']['api']['environment']['DATABASE_URL'] = 'postgresql+asyncpg://pilot:do-not-print-this@db:5432/pilot'
        errors = preflight.validate_config(config)
        self.assertTrue(any('DATABASE_URL' in e for e in errors))
        self.assertFalse(any('do-not-print-this' in e for e in errors))

    def test_percent_encoded_password_matches_rendered_compose_dollar_escaping(self):
        config = valid_config()
        config['services']['db']['environment']['POSTGRES_PASSWORD'] = 'isolated-$$-password'
        config['services']['api']['environment']['DATABASE_URL'] = 'postgresql+asyncpg://pilot:isolated-%24-password@db:5432/pilot'
        self.assertEqual(preflight.validate_config(config), [])

    def test_rejects_placeholder_secret_and_development_port(self):
        config = valid_config()
        env = config['services']['api']['environment']
        env['JWT_SECRET_KEY'] = 'sua_chave_secreta_jwt_gerada_aqui'
        env['FRONTEND_ORIGIN'] = env['PASSWORD_RESET_URL'] = 'https://pilot.example.invalid:3443/'
        errors = preflight.validate_config(config)
        self.assertTrue(any('JWT_SECRET_KEY' in e for e in errors))
        self.assertTrue(any('443' in e for e in errors))


class CertificateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_path = os.environ.get('PATH', '')
        git_openssl = Path('C:/Program Files/Git/usr/bin/openssl.exe')
        if shutil.which('openssl') is None and git_openssl.is_file():
            cls.path_patch = patch.dict(os.environ, {'PATH': str(git_openssl.parent) + os.pathsep + cls.original_path})
            cls.path_patch.start()
            cls.addClassCleanup(cls.path_patch.stop)
        if shutil.which('openssl') is None:
            raise unittest.SkipTest('OpenSSL indisponivel para o teste de certificado.')
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        cls.directory = Path(cls.temp.name)
        for name in ('first', 'second'):
            subprocess.run(['openssl', 'req', '-x509', '-nodes', '-newkey', 'rsa:2048', '-days', '2',
                            '-subj', '/CN=pilot.example.invalid', '-addext', 'subjectAltName=DNS:pilot.example.invalid',
                            '-keyout', str(cls.directory / (name + '.key')), '-out', str(cls.directory / (name + '.crt'))],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

    def test_correct_name_and_key(self):
        preflight.validate_certificate(self.directory / 'first.crt', self.directory / 'first.key', 'pilot.example.invalid')

    def test_wrong_dns_name_is_rejected(self):
        with self.assertRaises(preflight.PreflightError):
            preflight.validate_certificate(self.directory / 'first.crt', self.directory / 'first.key', 'other.example.invalid')

    def test_wrong_private_key_is_rejected(self):
        with self.assertRaises(preflight.PreflightError):
            preflight.validate_certificate(self.directory / 'first.crt', self.directory / 'second.key', 'pilot.example.invalid')


if __name__ == '__main__':
    unittest.main()
