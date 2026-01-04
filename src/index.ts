
import { Boom } from '@hapi/boom';
import NodeCache from '@cacheable/node-cache';
import readline from 'readline';
import makeWASocket, {
  AnyMessageContent,
  CacheStore,
  delay,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  proto,
  useMultiFileAuthState,
  WAMessageContent,
  WAMessageKey,
   
} from '@whiskeysockets/baileys';
import P from 'pino';
import axios from 'axios';
import moment from 'moment';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import sharp from 'sharp';
import { execSync } from 'child_process';
import fs from 'fs';
import * as os from 'os';	



const imgMenu = "https://i.ibb.co/MDdvjFVh/109054.jpg";
const imgChat = "https://i.ibb.co/vCmPNj6W/6ee76fa456b8ee8f06c52011276e1041.jpg";
const imgGroup = "https://i.ibb.co/BHHmyS46/EEWC-o2-MDVg-MEz7jm8-Fbn-3343437531.webp";
const imgHelp = "https://i.ibb.co/c7Y4bn1/9780b13155bf33e2ab441389a38545ac.jpg";


const qrcode = require('qrcode-terminal');
const logger = P({
  level: 'trace',
  transport: {
    targets: [{ target: 'pino-pretty', options: { colorize: true } }],
  },
});
const COMMAND_PREFIX = '/';
const msgRetryCounterCache = new NodeCache() as CacheStore;

/********************************************************************
 *  FUNÇÕES AUXILIARES
 ********************************************************************/
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (txt: string): Promise<string> => new Promise((res) => rl.question(txt, res));

function parseCommand(txt: string): string | null {
  const t = txt.trim().toLowerCase();
  if (t.startsWith(COMMAND_PREFIX)) return t.slice(COMMAND_PREFIX.length);
  if (t === 'open_group' || t === 'close_group') return t;
  return null;
}

async function sendWithTyping(sock: any, jid: string, msg: AnyMessageContent) {
  await sock.presenceSubscribe(jid);
  await delay(500);
  await sock.sendPresenceUpdate('composing', jid);
  await delay(2000);
  await sock.sendPresenceUpdate('paused', jid);
  await sock.sendMessage(jid, msg);
}

async function sendWithTypingQ(
  sock: any,
  jid: string, 
  msg: AnyMessageContent, 
  quoted: any
) {
   await sock.presenceSubscribe(jid);
   await delay(500);
   await sock.sendPresenceUpdate('composing', jid);
   await delay(2000);
   await sock.sendPresenceUpdate('paused', jid);
   await sock.sendMessage(jid, msg, { quoted: msg });
}

/********************************************************************
 *  MAIN – inicia a sessão
 ********************************************************************/
const App = async () => {
  const { state, saveCreds } = await useMultiFileAuthState('registration/tmp');
  const { version } = await fetchLatestBaileysVersion();


  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    msgRetryCounterCache,
    generateHighQualityLinkPreview: true,
    getMessage,
  });

  if (process.argv.includes('--use-pairing-code') && !sock.authState.creds.registered) {
    const phone = await question('Phone number (inclua DDI): ');
    const code = await sock.requestPairingCode(phone);
    console.log(`Pairing code: ${code}`);
  }

  sock.ev.process(async (events) => {
    if (events['connection.update']) {
      const { connection, lastDisconnect, qr } = events['connection.update'];
      if (qr) qrcode.generate(qr, { small: true });

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          console.log('🔄 Reconectando...');
          App();
        } else {
          console.log('❌ Sessão encerrada (logged out).');
        }
      }
    }

    if (events['creds.update']) await saveCreds();



    if (events['messages.upsert']) {
      const up = events['messages.upsert'];
      if (up.type !== 'notify') return;
      
      for (const msg of up.messages) {

        const text =
          msg.message?.conversation ??
          msg.message?.extendedTextMessage?.text ??
          msg.message?.imageMessage?.caption ??
          msg.message?.videoMessage?.caption ??
          '';

        const jid = msg.key.remoteJid!;
        const cmd = parseCommand(text);
        if (!cmd) continue;

        console.log('🟢 Comando:', cmd, '| jid:', jid);

        try {
          switch (cmd) {
	  
           case 'menu':
           await sendWithTyping(sock, jid,
        	{ image: 
                        { url: 
                               imgMenu 
                        },
                           caption: '> Menu\n\n/Service\n/Group\n/Help' 
                 }
           ); 
	   break;


	   case 'group':
           await sendWithTyping(sock, jid,
		 { image: { url: imgGroup }, caption:'/Admin\n/Member' });
	   break;


	   case 'admin':
           await sendWithTyping(sock, jid, 
	   { image: 
		   { url: imgGroup }, 
		   caption: '> Admin\n\n> Permissions:\n/open_group\n/close_group\n/allow_modify_group\n/block_modify_group\n/invite_group\n>Moderation:\n/ban' });
           break;		   

	   case 'member':
           await sendWithTyping(sock, jid,
	   { image: { url: imgGroup }, caption: '> ' } );
	   break;	   

         /*Commands of Group*/

          case 'open_group':
              await sock.groupSettingUpdate(jid, 'not_announcement');
              await sendWithTyping(sock, jid, { text: '🔓 Grupo aberto! Todos podem conversar.' });
              break;
            case 'close_group':
              await sock.groupSettingUpdate(jid, 'announcement');
              await sendWithTyping(sock, jid, { text: '🔒 Grupo fechado! Apenas admins podem enviar.' });
              break;
            case 'allow_modify_group':
              await sock.groupSettingUpdate(jid, 'unlocked');
              break;
            case 'block_modify_group':
              await sock.groupSettingUpdate(jid, 'locked');
              break;
            case 'invite_group':
              const code = await sock.groupInviteCode(jid);
              await sendWithTyping(sock, jid, {
                text: `Follow this link to join my WhatsApp group: https://chat.whatsapp.com/${code}`
              });
              break;


	    case 'help':
            await sendWithTyping(sock, jid, 
		  { image: { url: imgHelp }, caption: 'System/\n/Report_Bug' });
	    break;
	    

           /*Colocar na session Chat*/
	    case 's':
            case 'sticker': {

              const mediaMsg = msg.message.imageMessage ?? 
		               msg.message.videoMessage;

              if (!mediaMsg) {
                await sendWithTypingQ(sock, jid, { text: "❗ Envie uma imagem ou vídeo junto com o comando /sticker." }, { quoted: msg });
                break;
              }

              const stream = await downloadContentFromMessage(mediaMsg, 'image');
              let buffer = Buffer.alloc(0);
              for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
              }

              let stickerBuf: Buffer;

              if (mediaMsg.mimetype?.startsWith("image")) {
                stickerBuf = await sharp(buffer)
                  .resize(512, 512, { fit: "inside" })
                  .webp()
                  .toBuffer();
              } else if (mediaMsg.mimetype?.startsWith("video")) {
                const tmpIn = "/tmp/tmp_input.mp4";
                const tmpOut = "/tmp/tmp_output.webp";
                fs.writeFileSync(tmpIn, buffer);
                execSync(
                  `ffmpeg -y -i ${tmpIn} -vf "scale=512:512:force_original_aspect_ratio=decrease" -vcodec libwebp -lossless 1 -preset picture -loop 0 -an -vsync 0 -s 512:512 ${tmpOut}`
                );
                stickerBuf = fs.readFileSync(tmpOut);
                fs.unlinkSync(tmpIn);
                fs.unlinkSync(tmpOut);
              } else {
                stickerBuf = buffer;
              }

              await sock.sendMessage(jid, { sticker: stickerBuf }, { quoted: msg });
              await sendWithTypingQ(sock, jid, { text: "✅ Figurinha enviada!" }, { quoted: msg });
              break;
            }
          }
        } catch (e) {
          console.error('❗ Erro:', e);
        }
      }
    }
  });

  return sock;
};

/********************************************************************
 *  PLACEHOLDER GET MESSAGE
 ********************************************************************/
async function getMessage(_: WAMessageKey): Promise<WAMessageContent | undefined> {
  return proto.Message.create({ conversation: '' });
}

/********************************************************************
 *  INICIA
 ********************************************************************/
App().catch(console.error);

