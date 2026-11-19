import copy
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    "prepare_glpi", ROOT / "scripts/prepare_glpi_workflows.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def source():
    return [
        {
            "id": str(index),
            "nodes": [
                {"type": "n8n-nodes-base.webhook", "parameters": {"path": path}},
                {
                    "type": "n8n-nodes-base.httpRequest",
                    "parameters": {
                        "url": "https://glpi.example.invalid/apirest.php/initSession",
                        "headerParameters": {
                            "parameters": [
                                {"name": "App-Token", "value": "demo-app"},
                                {
                                    "name": "Authorization",
                                    "value": "user_token demo-user",
                                },
                                {"name": "Session-Token"},
                            ]
                        },
                    },
                },
            ],
            "settings": {"saveDataSuccessExecution": "none"},
        }
        for index, path in enumerate(
            ("reservar_ativos", "cancelar_reserva", "atualizar_estoque"), 1
        )
    ]


class WorkflowPreparationTests(unittest.TestCase):
    def test_existing_ids_are_preserved_and_inspection_gets_its_own_id(self):
        output = module.prepare(
            source(),
            [{"id_glpi": "1", "identity": "PAT-DEMO"}],
            ROOT / "integrations/n8n",
        )
        self.assertEqual(len(output), 4)
        by_path = {
            next(
                n["parameters"]["path"]
                for n in w["nodes"]
                if n["type"].endswith(".webhook")
            ): w
            for w in output
        }
        self.assertEqual(by_path["atualizar_estoque"]["id"], "3")
        self.assertNotIn(by_path["consultar_reservas"]["id"], ("1", "2", "3"))
        self.assertEqual(by_path["reservar_ativos"]["settings"]["executionTimeout"], 45)
        self.assertEqual(
            by_path["reservar_ativos"]["settings"]["saveDataSuccessExecution"], "none"
        )
        self.assertTrue(all(not w["active"] for w in output))
        self.assertNotIn("__GLPI_", str(output))
        self.assertIn("PAT-DEMO", str(by_path["atualizar_estoque"]))
        probe = by_path["consultar_reservas"]
        self.assertFalse(any(n["type"].endswith(".telegram") for n in probe["nodes"]))
        methods = [
            n["parameters"].get("method", "GET")
            for n in probe["nodes"]
            if n["type"].endswith(".httpRequest")
        ]
        self.assertTrue(all(method == "GET" for method in methods))

    def test_ambiguous_identifiers_and_workflows_fail_closed(self):
        with self.assertRaises(ValueError):
            module.prepare(
                source(),
                [{"id_glpi": "1", "identity": "A"}, {"id_glpi": "1", "identity": "B"}],
                ROOT / "integrations/n8n",
            )
        duplicate = source()
        duplicate.append(copy.deepcopy(duplicate[0]))
        with self.assertRaises(ValueError):
            module.prepare(
                duplicate,
                [{"id_glpi": "1", "identity": "A"}],
                ROOT / "integrations/n8n",
            )

    def test_missing_credentials_are_not_rendered_as_empty_tokens(self):
        data = source()
        data[0]["nodes"][1]["parameters"]["headerParameters"]["parameters"] = []
        with self.assertRaises(ValueError):
            module.prepare(
                data, [{"id_glpi": "1", "identity": "A"}], ROOT / "integrations/n8n"
            )
