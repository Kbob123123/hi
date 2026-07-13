import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import {
  getAllExists,
  getAllRap,
  resolvePetName,
  describeVariantFromConfig,
  getPetTierMap,
  getPetThumbnailMap,
} from '../ps99Api.js';
import { formatNumber } from '../format.js';
import {
  recordPetExistsSnapshot,
  getPetExistsSeries,
  recordPetRapSnapshot,
  getPetRapSeries,
} from '../history.js';
import { resolveThumbnail } from '../thumbnails.js';
import { buildPetExistsChartUrl } from '../charts.js';

export const data = new SlashCommandBuilder()
  .setName('pet')
  .setDescription('Get exists + RAP info for a specific pet')
  .addStringOption((opt) =>
    opt.setName('name').setDescription('Pet name (exact match preferred, partial ok)').setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();
  const query = interaction.options.getString('name');

  try {
    const [existsData, rapData, tierMap, thumbnailMap] = await Promise.all([
      getAllExists(),
      getAllRap(),
      getPetTierMap(),
      getPetThumbnailMap(),
    ]);

    // Resolve to ONE specific pet (exact match preferred, otherwise the
    // closest/shortest partial match) instead of returning every pet whose
    // name happens to contain the query — a search for "dragon" should show
    // one dragon's variants, not fifteen different dragons at once.
    const resolvedName = resolvePetName(existsData, query);
    if (!resolvedName) {
      await interaction.editReply(`No pet found matching **${query}**.`);
      return;
    }

    // Now gather only THIS pet's variants (normal/golden/rainbow/shiny) from
    // both exists and RAP data.
    const existsVariants = existsData.filter((e) => e.configData?.id === resolvedName);
    const rapByVariantKey = new Map();
    for (const r of rapData) {
      if (r.configData?.id !== resolvedName) continue;
      const key = `${r.configData?.pt ?? 0}|${r.configData?.sh ? 1 : 0}`;
      rapByVariantKey.set(key, r.value);
    }

    const tier = tierMap.get(resolvedName) ?? null;
    const tierTag = tier ? ` [${tier.charAt(0).toUpperCase() + tier.slice(1)}]` : '';

    const lines = existsVariants.map((entry) => {
      const variant = describeVariantFromConfig(entry.configData ?? {});
      const variantKey = `${entry.configData?.pt ?? 0}|${entry.configData?.sh ? 1 : 0}`;
      const rap = rapByVariantKey.get(variantKey);
      return `**${variant}** — Exists: ${formatNumber(entry.value)}${
        rap !== undefined ? ` · RAP: ${formatNumber(rap)}` : ''
      }`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`${resolvedName}${tierTag}`)
      .setColor(0xfee75c)
      .setDescription(lines.join('\n') || 'No variant data found.')
      .setFooter({ text: 'Exists refreshes ~60s · RAP refreshes ~4hr' });

    // Use the "Normal" variant (pt=0, sh=false) for the thumbnail + charts —
    // the most representative single variant of this pet. Falls back to
    // whatever variant was actually returned first if there's no normal one.
    const primaryEntry =
      existsVariants.find((e) => (e.configData?.pt ?? 0) === 0 && !e.configData?.sh) ?? existsVariants[0];
    const primaryCfg = primaryEntry?.configData ?? {};
    const primaryKey = `${resolvedName}|${primaryCfg.pt ?? 0}|${primaryCfg.sh ? 1 : 0}`;

    if (primaryEntry) {
      // Record this lookup into shared history so repeated /pet calls build
      // up chartable series even for pets outside the tracker's Huge/
      // Titanic/Gargantuan focus.
      recordPetExistsSnapshot(primaryKey, primaryEntry.value);
      const primaryRap = rapByVariantKey.get(`${primaryCfg.pt ?? 0}|${primaryCfg.sh ? 1 : 0}`);
      if (primaryRap !== undefined) {
        recordPetRapSnapshot(primaryKey, primaryRap);
      }
    }

    const thumb = thumbnailMap.get(resolvedName);
    const rbxId = primaryCfg.pt === 1 ? thumb?.goldenThumbnail || thumb?.thumbnail : thumb?.thumbnail;
    if (rbxId) {
      const iconUrl = await resolveThumbnail(rbxId, '150x150');
      if (iconUrl) embed.setThumbnail(iconUrl);
    }

    // Exists-over-time chart (primary image)
    const existsSeries = getPetExistsSeries(primaryKey);
    const existsChartUrl = await buildPetExistsChartUrl(resolvedName, existsSeries, {
      label: 'Exists Over Time',
      color: '#5ee65e',
    });
    if (existsChartUrl) {
      embed.setImage(existsChartUrl);
    } else {
      embed.addFields({
        name: 'Exists Chart',
        value: 'Not enough history yet — check back after a couple more lookups or tracker cycles.',
      });
    }

    // RAP-over-time chart (as a second embed, since one embed only supports
    // one large image — Discord embeds allow exactly one .setImage())
    const rapSeries = getPetRapSeries(primaryKey);
    const rapChartUrl = await buildPetExistsChartUrl(resolvedName, rapSeries, {
      label: 'RAP Over Time',
      color: '#4fc3f7',
    });

    const embeds = [embed];
    if (rapChartUrl) {
      const rapEmbed = new EmbedBuilder().setColor(0xfee75c).setImage(rapChartUrl);
      embeds.push(rapEmbed);
    }

    await interaction.editReply({ embeds });
  } catch (err) {
    await interaction.editReply(`Couldn't fetch pet data: ${err.message}`);
  }
}
