// Ignorar certificados SSL (somente em redes bloqueadas, como a sua)
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

client.once('ready', () => {
  console.log(`Bot logado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Ignora mensagens de bots ou que não começam com !play
  if (message.author.bot || !message.content.startsWith('!play')) return;

  const args = message.content.split(' ');
  const query = args.slice(1).join(' ');
  if (!query) return message.reply('Você precisa digitar o nome da música ou um link do YouTube.');

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.reply('Você precisa estar em um canal de voz primeiro.');

  try {
    let videoURL = query;

    // Se não for link direto, busca no YouTube
    if (!ytdl.validateURL(query)) {
      const searchResult = await ytSearch(query);
      if (!searchResult.videos.length) return message.reply('Não achei essa música :(');
      videoURL = searchResult.videos[0].url;
    }

    const stream = ytdl(videoURL, {
        filter: 'audioonly',
        quality: 'highestaudio',
        requestOptions: {
            headers: {
            // Spoof user-agent para parecer navegador normal
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/58.0.3029.110 Safari/537.3',
            },
        },
    });

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    const resource = createAudioResource(stream);
    const player = createAudioPlayer();

    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      connection.destroy(); // Sai do canal quando termina
    });

    const info = await ytdl.getInfo(videoURL);
    message.reply(`▶️ Tocando: **${info.videoDetails.title}**`);

  } catch (err) {
    console.error('Erro ao tentar tocar:', err);
    message.reply('❌ Ocorreu um erro ao tentar tocar a música.');
  }
});

client.login(process.env.DISCORD_TOKEN);
