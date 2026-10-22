// Leitor NFC — "Monte a comunidade de peixes"
// Extensão "Re-conhecendo nosso rio" — Cachoeiras de Macacu (RJ)
//
// Lê o UID de tags NTAG213/215 com um RC522 e imprime na serial (115200 baud)
// uma linha por leitura, no formato:   UID:04A1B2C3D4E5F6
//
// Outras linhas que o firmware pode imprimir (a página web ignora):
//   PRONTO                 -> leitor iniciado
//   INFO:...               -> mensagens informativas
//   ERRO:...               -> RC522 não encontrado (verifique a ligação)
//
// Para usar na IDE Arduino: crie uma pasta "leitor_peixes", copie este arquivo
// como "leitor_peixes.ino" e instale a biblioteca "MFRC522" (miguelbalboa).

#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>

// ---- Pinos (SPI padrão do ESP32 — ver LIGACAO.md) ----
constexpr uint8_t PIN_SS   = 5;
constexpr uint8_t PIN_SCK  = 18;
constexpr uint8_t PIN_MOSI = 23;
constexpr uint8_t PIN_MISO = 19;
constexpr uint8_t PIN_RST  = 22;
constexpr uint8_t PIN_LED  = 2;   // LED azul da placa na maioria das ESP32 DevKit

// ---- Ajustes ----
constexpr uint32_t DEBOUNCE_MS     = 1000;  // mesma tag não repete antes disso
constexpr uint32_t LED_LEITURA_MS  = 150;   // LED aceso ao ler uma tag
constexpr uint32_t BATIMENTO_MS    = 2000;  // piscadinha "estou vivo"
constexpr uint32_t REINICIA_ERRO_MS = 3000; // nova tentativa se o RC522 falhar

MFRC522 rfid(PIN_SS, PIN_RST);

String   ultimoUid;
uint32_t ultimoUidMs = 0;
uint32_t ledLeituraAte = 0;
bool     leitorOk = false;
uint32_t ultimaTentativaMs = 0;

bool iniciarLeitor() {
  rfid.PCD_Init();
  delay(10);
  byte versao = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (versao == 0x00 || versao == 0xFF) {
    Serial.println(F("ERRO:RC522 nao encontrado - verifique a ligacao e os 3,3 V"));
    return false;
  }
  // Ganho máximo da antena: ajuda a ler a tag através do plástico do peixe.
  rfid.PCD_SetAntennaGain(MFRC522::RxGain_max);
  Serial.print(F("INFO:RC522 versao 0x"));
  Serial.println(versao, HEX);
  Serial.println(F("PRONTO"));
  return true;
}

String uidParaTexto(const MFRC522::Uid &uid) {
  String s;
  s.reserve(uid.size * 2);
  for (byte i = 0; i < uid.size; i++) {
    if (uid.uidByte[i] < 0x10) s += '0';
    s += String(uid.uidByte[i], HEX);
  }
  s.toUpperCase();
  return s;
}

void atualizarLed(uint32_t agora) {
  bool aceso;
  if (!leitorOk) {
    aceso = (agora / 100) % 2;                    // erro: pisca rápido
  } else if (agora < ledLeituraAte) {
    aceso = true;                                 // acabou de ler
  } else {
    aceso = (agora % BATIMENTO_MS) < 40;          // batimento discreto
  }
  digitalWrite(PIN_LED, aceso ? HIGH : LOW);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);
  SPI.begin(PIN_SCK, PIN_MISO, PIN_MOSI, PIN_SS);
  delay(50);
  leitorOk = iniciarLeitor();
  ultimaTentativaMs = millis();
}

void loop() {
  uint32_t agora = millis();
  atualizarLed(agora);

  if (!leitorOk) {
    if (agora - ultimaTentativaMs > REINICIA_ERRO_MS) {
      ultimaTentativaMs = agora;
      leitorOk = iniciarLeitor();
    }
    return;
  }

  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uid = uidParaTexto(rfid.uid);

  // Debounce: ignora a mesma tag lida de novo em menos de DEBOUNCE_MS.
  // O tempo é renovado a cada leitura, então uma tag "balançando" na borda
  // do campo só conta de novo depois de ficar ~1 s longe do leitor.
  bool repetida = (uid == ultimoUid) && (agora - ultimoUidMs < DEBOUNCE_MS);
  ultimoUid = uid;
  ultimoUidMs = agora;

  if (!repetida) {
    Serial.print(F("UID:"));
    Serial.println(uid);
    ledLeituraAte = agora + LED_LEITURA_MS;
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}
