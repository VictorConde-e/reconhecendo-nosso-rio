# Ligação ESP32 + RC522

O RC522 funciona **só com 3,3 V**. Ligar no 5 V pode queimar o módulo.

| RC522 (pino) | ESP32 (GPIO) | Observação                  |
|--------------|--------------|-----------------------------|
| SDA / SS     | GPIO 5       | Chip select (SPI VSPI)      |
| SCK          | GPIO 18      | Clock SPI                   |
| MOSI         | GPIO 23      |                             |
| MISO         | GPIO 19      |                             |
| IRQ          | não ligar    | Não é usado                 |
| GND          | GND          |                             |
| RST          | GPIO 22      | Reset                       |
| 3.3V         | 3V3          | **Nunca 5 V**               |

```
   RC522                      ESP32 DevKit
 ┌────────┐                 ┌─────────────┐
 │ SDA ───┼─────────────────┼── GPIO 5    │
 │ SCK ───┼─────────────────┼── GPIO 18   │
 │ MOSI ──┼─────────────────┼── GPIO 23   │
 │ MISO ──┼─────────────────┼── GPIO 19   │
 │ IRQ    │ (livre)         │             │
 │ GND ───┼─────────────────┼── GND       │
 │ RST ───┼─────────────────┼── GPIO 22   │
 │ 3.3V ──┼─────────────────┼── 3V3       │
 └────────┘                 │             │
                            │  GPIO 2 ──[330 Ω]──▶|── GND   (LED externo, opcional)
                            └─────────────┘
```

## LED de status (GPIO 2)

A maioria das placas ESP32 DevKit já tem um LED azul ligado ao GPIO 2, então não precisa de LED externo. Se quiser um LED maior na caixa, ligue o GPIO 2 → resistor de 330 Ω → LED (perna longa) → GND.

| LED                          | Significado                          |
|------------------------------|--------------------------------------|
| Piscadinha a cada 2 s        | Funcionando, esperando um peixe      |
| Aceso por um instante        | Leu uma tag                          |
| Piscando rápido sem parar    | RC522 não encontrado (ver a ligação) |

O GPIO 2 também é usado na inicialização da placa (pino de *strapping*). Um LED com resistor não atrapalha, mas não ligue nada que puxe o pino para 3,3 V.

## Testar

1. Grave o firmware com `pio run -t upload` (ou pela IDE Arduino).
2. Abra o monitor serial em **115200** baud: `pio device monitor`.
3. Deve aparecer `PRONTO`. Encoste uma tag e confira se aparece `UID:04....`.
4. **Feche o monitor serial antes de abrir a página web.** A porta só pode ser usada por um programa de cada vez.

Se aparecer `ERRO:RC522 nao encontrado`, revise SDA, SCK, MOSI, MISO e a alimentação. Também vale trocar os jumpers, porque jumper com mau contato é a causa mais comum.

## Dicas para tags dentro dos peixes impressos em 3D

- O alcance do RC522 com NTAG213/215 costuma ser de **1 a 3 cm**. Prefira tags redondas de **25 mm ou mais**; as de 10–13 mm leem mal.
- Na impressão, **pause numa camada** perto da superfície, coloque a tag e continue imprimindo. Deixe no máximo 1–2 mm de plástico entre a tag e a face que encosta no leitor.
- Marque no peixe o lado da tag (um "olho" ou uma escama em relevo) para o público saber onde encostar.
- Não use metal, tinta metálica nem filamento com carga metálica perto da tag.
- Fixe o RC522 embaixo de uma tampa fina (MDF ou acrílico de 2–3 mm) e marque o alvo com um desenho de "ondinha".
- O RC522 é sensível a cabos longos. Mantenha os fios SPI com menos de 20 cm.
