import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getActiveClanBattle } from '../ps99Api.js';

export const data = new SlashCommandBuilder()
  .setName('battle')
  .setDescription('Show the currently active clan battle');

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const battle = await getActiveClanBattle();

    const embed = new EmbedBuilder()
      .setTitle(battle.configName ?? 'Active Clan Battle')
      .setColor(0xed4245)
      .addFields({ name: 'Category', value: battle.category ?? 'N/A', inline: true });

    const rewards = battle.configData?.PlacementRewards;
    if (Array.isArray(rewards) && rewards.length) {
      const rewardLines = rewards.slice(0, 10).map((r) => {
        const item = r.Item?._data?.id ?? 'Unknown item';
        return `#${r.Best}–${r.Worst}: ${item}`;
      });
      embed.addFields({ name: 'Placement Rewards', value: rewardLines.join('\n') });
    }

    embed.setFooter({
      text: 'Note: this endpoint can lag a few hours behind the real battle switch (known upstream issue).',
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`Couldn't fetch active clan battle: ${err.message}`);
  }
}
