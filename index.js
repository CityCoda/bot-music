// Ignorar certificados SSL (caso necessário em redes bloqueadas)
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus
} = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const ffmpegPath = require('ffmpeg-static');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

client.once('ready', () => {
  console.log(`✅ Bot logado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith('!play')) return;

  const args = message.content.split(' ');
  const query = args.slice(1).join(' ');
  if (!query) return message.reply('❗ Você precisa digitar o nome da música ou um link do YouTube.');

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.reply('❗ Você precisa estar em um canal de voz.');

  try {
    let videoURL = query;

    // Se não for link, faz a busca
    if (!ytdl.validateURL(query)) {
      const result = await ytSearch(query);
      if (!result.videos.length) return message.reply('🔍 Música não encontrada.');
      videoURL = result.videos[0].url;
    }

    const stream = ytdl(videoURL, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25, // Reduz chance de corte
      requestOptions: {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/58.0.3029.110 Safari/537.3',
        },
      },
    });

    const resource = createAudioResource(stream);
    const player = createAudioPlayer();

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    connection.subscribe(player);
    await entersState(connection, VoiceConnectionStatus.Ready, 5_000);

    player.play(resource);

    player.once(AudioPlayerStatus.Idle, () => {
      connection.destroy();
    });

    player.on('error', error => {
      console.error('🔴 Erro no player:', error);
      message.reply('❌ Ocorreu um erro ao tentar tocar o áudio.');
      connection.destroy();
    });

    const info = await ytdl.getInfo(videoURL);
    message.reply(`🎶 Tocando agora: **${info.videoDetails.title}**`);

  } catch (err) {
    console.error('Erro ao tentar tocar:', err);
    message.reply('❌ Não consegui tocar a música. Tente novamente ou verifique o link.');
  }
});

client.login(process.env.DISCORD_TOKEN);
