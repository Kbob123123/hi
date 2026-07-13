import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getAllRap, findByName, formatEntry } from '../ps99Api.js';
import { formatNumber } from '../format.js';
import { buildDeltaBarChartUrl } from '../charts.js';

export const data = new SlashCommandBuilder()
  .setName('rap')
  .setDescription('Look up Recent Average Price (RAP) for a PS99 item or pet')
  .addStringOption((opt) =>
    opt.setName('item').setDescription('Item or pet name (partial match ok)').setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const query = interaction.options.getString('item');

  try {
    const all = await getAllRap();
    const matches = findByName(all, query);

    if (matches.length === 0) {
      await interaction.editReply(`No RAP data found matching **${query}**.`);
      return;
    }

    const top = matches.slice(0, 15).map(formatEntry);

    const embed = new EmbedBuilder()
      .setTitle(`RAP results for "${query}"`)
      .setColor(0x5865f2)
      .setDescription(
        top
          .map((e) => `**${e.name}** (${e.variant}) — ${formatNumber(e.value)}`)
          .join('\n')
      )
      .setFooter({
        text:
          matches.length > 15
            ? `Showing 15 of ${matches.length} matches · Data cached up to 4hrs by the API`
            : 'Data cached up to 4hrs by the API',
      });

    if (top.length > 1) {
      const chartUrl = await buildDeltaBarChartUrl(
        `RAP Comparison — "${query}"`,
        top.map((e) => ({ name: `${e.name} (${e.variant})`, value: e.value })),
        { valueLabel: 'RAP' }
      );
      if (chartUrl) embed.setImage(chartUrl);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`Couldn't fetch RAP data: ${err.message}`);
  }
}
