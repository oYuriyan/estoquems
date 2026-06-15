import pytest
from unittest.mock import patch, AsyncMock
import httpx

@pytest.mark.asyncio
async def test_n8n_webhook_cancellation_mock():
    """
    Garante que o client AsyncMock intercepta a chamada HTTP para o n8n.
    Base para testes robustos das rotas de quotes sem disparar gatilhos reais.
    """
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_response = httpx.Response(200, request=httpx.Request("POST", "http://n8n:5678/webhook/cancelar_reserva"))
        mock_post.return_value = mock_response

        # Simulação de envio da API (app/api/quotes.py)
        async with httpx.AsyncClient() as client:
            res = await client.post("http://n8n:5678/webhook/cancelar_reserva", json={"quote_id": "mock-id"})
            
        assert res.status_code == 200
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "http://n8n:5678/webhook/cancelar_reserva"
        assert kwargs["json"] == {"quote_id": "mock-id"}
