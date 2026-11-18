"""Bind public n8n templates to a private workflow export, without network or deployment."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit
import uuid


def prepare(export, identities, templates):
    aliases = {}
    for item in identities:
        glpi_id = str(item.get('id_glpi') or '').strip()
        identity = str(item.get('identity') or '').strip()
        if not glpi_id:
            continue
        if not identity or (glpi_id in aliases and aliases[glpi_id] != identity):
            raise ValueError('Identidade GLPI ausente ou ambigua; conferir antes de preparar.')
        aliases[glpi_id] = identity
    if not aliases:
        raise ValueError('O mapa de identidades existentes e obrigatorio.')
    output = []
    for path in sorted(templates.glob('*.template.json')):
        text = path.read_text(encoding='utf-8')
        template = json.loads(text)
        webhook = next(n['parameters']['path'] for n in template['nodes'] if n['type'].endswith('.webhook'))
        matches = [w for w in export if any(n['type'].endswith('.webhook') and n.get('parameters', {}).get('path') == webhook for n in w['nodes'])]
        if len(matches) != 1:
            raise ValueError('Workflow de origem ausente ou ambiguo: ' + webhook)
        source = matches[0]
        session_nodes = [n for n in source['nodes'] if '/initSession' in n.get('parameters', {}).get('url', '')]
        if len(session_nodes) != 1:
            raise ValueError('Configuracao de sessao GLPI ausente ou ambigua.')
        params = session_nodes[0]['parameters']
        base = params['url'].lstrip('=').rsplit('/initSession', 1)[0].rstrip('/')
        url = urlsplit(base)
        if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password or url.query or url.fragment:
            raise ValueError('URL base GLPI invalida; conferir a configuracao privada.')
        headers = {h['name'].lower(): h.get('value') for h in params['headerParameters']['parameters']}
        replacements = {
            '__GLPI_API_BASE__': base,
            '__GLPI_APP_TOKEN__': headers.get('app-token'),
            '__GLPI_USER_TOKEN_AUTHORIZATION__': headers.get('authorization'),
            '__GLPI_LEGACY_IDENTITIES__': json.dumps(aliases, ensure_ascii=False),
        }
        for key, value in replacements.items():
            if not isinstance(value, str) or not value or value.startswith('=') or '__GLPI_' in value:
                raise ValueError('Configuracao privada GLPI incompleta.')
            # Values are inserted inside JSON string literals, including JavaScript source.
            text = text.replace(key, json.dumps(value, ensure_ascii=False)[1:-1])
        if '__GLPI_' in text:
            raise ValueError('Template ainda contem campos nao configurados.')
        workflow = json.loads(text)
        workflow['id'] = source['id']
        workflow['versionId'] = str(uuid.uuid4())
        workflow['active'] = False
        workflow['settings'] = source.get('settings', {})
        output.append(workflow)
    if len(output) != 3:
        raise ValueError('Sao esperados tres templates GLPI.')
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export', type=Path, required=True, help='Exportacao privada CLI dos workflows publicados.')
    parser.add_argument('--identities', type=Path, required=True, help='JSON privado com id_glpi e identity dos equipamentos locais.')
    parser.add_argument('--output', type=Path, required=True, help='Novo arquivo privado de saida; nao sobrescreve arquivos.')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve()
    if output.is_relative_to(root) and not output.is_relative_to(root / 'work'):
        parser.error('A saida contem segredos: use work/ ignorado pelo Git ou diretorio privado fora do repositorio.')
    try:
        data = prepare(json.loads(args.export.read_text(encoding='utf-8')),
                       json.loads(args.identities.read_text(encoding='utf-8')),
                       root / 'integrations/n8n')
        with output.open('x', encoding='utf-8') as target:
            target.write(json.dumps(data, ensure_ascii=False, indent=2))
    except ValueError as error:
        parser.exit(1, str(error) + '\n')
    except (KeyError, StopIteration, OSError):
        parser.exit(1, 'Preparacao nao concluida; conferir entradas, permissoes e arquivo de saida sem revelar credenciais.\n')
    print('Tres workflows preparados em arquivo privado. Nenhum workflow publicado ou executado.')


if __name__ == '__main__':
    main()
