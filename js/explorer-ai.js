(function (global) {
  'use strict';

  var STORAGE_KEY = 'snEducationGeminiApiKey';
  var DEFAULT_MODEL = 'gemma-4-31b-it';
  var FALLBACK_MODEL = 'gemini-3.1-flash-lite-preview';
  var SUPPORTED_INTENTS = [
    'base_sequence',
    'base_breathing_safety',
    'base_mantra_chakra',
    'base_repeats',
    'base_inverses',
    'shared_asanas',
    'same_asana_equivalences',
    'cyp_visual_references',
    'pose_guidance',
    'variant_pose_counts',
    'variant_sequence',
    'asana_variant_coverage',
    'unsupported'
  ];
  var TEMPLATE_LABELS = {
    base_sequence: 'Base sequence',
    base_breathing_safety: 'Breathing and safety notes',
    base_mantra_chakra: 'Mantra and chakra coverage',
    base_repeats: 'Repeated poses',
    base_inverses: 'Inverse pose pairs',
    shared_asanas: 'Shared asanas across variants',
    same_asana_equivalences: 'sameAsanaAs equivalences',
    cyp_visual_references: 'CYP visual references',
    pose_guidance: 'Base pose guidance',
    variant_pose_counts: 'Variant pose counts',
    variant_sequence: 'Variant sequence',
    asana_variant_coverage: 'Asana coverage by variant',
    unsupported: 'Unsupported question'
  };
  var INTENT_TO_QUESTION_ID = {
    base_sequence: 'base-sequence',
    base_breathing_safety: 'base-breathing-safety',
    base_mantra_chakra: 'base-mantra-chakra',
    base_repeats: 'base-repeats',
    base_inverses: 'base-inverses',
    shared_asanas: 'shared-asanas',
    same_asana_equivalences: 'same-asana-equivalences',
    cyp_visual_references: 'cyp-visual-references'
  };
  var PLANNER_SCHEMA = {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: SUPPORTED_INTENTS
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1
      },
      normalizedQuestion: {
        type: 'string'
      },
      asanaLabel: {
        type: ['string', 'null']
      },
      variantLabel: {
        type: ['string', 'null']
      },
      poseNumber: {
        type: ['integer', 'null'],
        minimum: 1,
        maximum: 24
      },
      wantsVisuals: {
        type: 'boolean'
      },
      rationale: {
        type: 'string'
      },
      unsupportedReason: {
        type: ['string', 'null']
      }
    },
    required: [
      'intent',
      'confidence',
      'normalizedQuestion',
      'asanaLabel',
      'variantLabel',
      'poseNumber',
      'wantsVisuals',
      'rationale',
      'unsupportedReason'
    ],
    additionalProperties: false
  };
  var EXPLANATION_SCHEMA = {
    type: 'object',
    properties: {
      answer: {
        type: 'string'
      }
    },
    required: ['answer'],
    additionalProperties: false
  };
  var PLANNER_SYSTEM_PROMPT = [
    'You are a query planner for a Surya Namaskar education workspace backed by an OWL ontology.',
    'You must map the user question to exactly one supported intent.',
    'Do not invent schema terms, new relations, or unsupported templates.',
    'If the question cannot be answered by the supported intents, return intent="unsupported".',
    'When a specific asana is mentioned, copy the exact ontology label when possible.',
    'When a specific variant is mentioned, copy the clearest variant label when possible.',
    'When a question asks about posture guidance, errors, corrections, rules, or constraints for a specific base pose or asana, choose pose_guidance.',
    'Questions asking about breathing, inhale, exhale, breath holding, safety notes, precautions, or careful practice across Base SN poses should map to base_breathing_safety.',
    'Questions asking how many poses a variant has, or comparing pose counts across variants, should map to variant_pose_counts.',
    'Questions asking what the different variants of Surya Namaskar are should also map to variant_pose_counts.',
    'Questions asking for the ordered poses or sequence of a named variant should map to variant_sequence.',
    'Questions asking which variants include a specific asana should map to asana_variant_coverage.',
    'Questions about poses or asanas common, shared, overlapping, or present across variants should map to shared_asanas.',
    'If a user asks about poses common across variants, answer at the asana identity level because cross-variant overlap is modeled through asana identity rather than one global numbered pose list.',
    'Return only JSON that matches the schema.'
  ].join(' ');
  var EXPLANATION_SYSTEM_PROMPT = [
    'You write concise educational explanations for a Surya Namaskar ontology workspace.',
    'Use only the supplied evidence.',
    'Do not invent pose counts, relations, or visual page references that are not present in the evidence JSON.',
    'If the evidence is limited, say so briefly instead of speculating.',
    'Use plain teaching language and return text only.'
  ].join(' ');

  function compactText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function isGemmaModel(modelName) {
    return /^gemma-/i.test(compactText(modelName));
  }

  function normalizeKey(value) {
    return compactText(value).toLowerCase();
  }

  function unique(items) {
    return items.filter(function (item, index) {
      return items.indexOf(item) === index;
    });
  }

  function joinList(items) {
    var values = items.filter(Boolean);

    if (!values.length) {
      return '';
    }
    if (values.length === 1) {
      return values[0];
    }
    if (values.length === 2) {
      return values[0] + ' and ' + values[1];
    }
    return values.slice(0, -1).join(', ') + ', and ' + values[values.length - 1];
  }

  function poseSummary(pose) {
    return 'Pose ' + pose.poseNumber + ' (' + pose.asanaLabel + ')';
  }

  function escapeSparqlString(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getQuestionById(questionId) {
    var questions = global.SNEducationData && global.SNEducationData.QUESTIONS
      ? global.SNEducationData.QUESTIONS
      : [];

    return questions.find(function (question) {
      return question.id === questionId;
    }) || null;
  }

  function withPrefixes(queryBody) {
    var prefixBlock = global.SNEducationData && global.SNEducationData.PREFIX_BLOCK
      ? global.SNEducationData.PREFIX_BLOCK
      : '';

    return prefixBlock ? prefixBlock + '\n\n' + queryBody.trim() : queryBody.trim();
  }

  function normalizeResultLanguage(language) {
    if (global.SNEducationData && typeof global.SNEducationData.normalizeResultLanguage === 'function') {
      return global.SNEducationData.normalizeResultLanguage(language);
    }
    return String(language || '').trim().toLowerCase() === 'te' ? 'te' : 'hi';
  }

  function getLanguageOption(language) {
    if (global.SNEducationData && typeof global.SNEducationData.getLanguageOption === 'function') {
      return global.SNEducationData.getLanguageOption(language);
    }
    return normalizeResultLanguage(language) === 'te'
      ? { code: 'te', label: 'Telugu', columnLabel: 'Telugu label' }
      : { code: 'hi', label: 'Hindi', columnLabel: 'Hindi label' };
  }

  function getLanguageColumnLabel(language) {
    return getLanguageOption(language).columnLabel;
  }

  function getRecordLanguageLabel(record, language) {
    if (global.SNEducationData && typeof global.SNEducationData.getRecordLanguageLabel === 'function') {
      return global.SNEducationData.getRecordLanguageLabel(record, language);
    }
    return record && record.labelsByLanguage && record.labelsByLanguage[normalizeResultLanguage(language)]
      ? record.labelsByLanguage[normalizeResultLanguage(language)]
      : '-';
  }

  function getPoseAsanaLanguageLabel(pose, language) {
    if (global.SNEducationData && typeof global.SNEducationData.getPoseAsanaLanguageLabel === 'function') {
      return global.SNEducationData.getPoseAsanaLanguageLabel(pose, language);
    }
    return pose && pose.asanaLabelsByLanguage && pose.asanaLabelsByLanguage[normalizeResultLanguage(language)]
      ? pose.asanaLabelsByLanguage[normalizeResultLanguage(language)]
      : '-';
  }

  function getBreathingPatternLanguageLabel(pose, language) {
    if (global.SNEducationData && typeof global.SNEducationData.getBreathingPatternLanguageLabel === 'function') {
      return global.SNEducationData.getBreathingPatternLanguageLabel(pose, language);
    }
    return pose && pose.breathingPatternLabelsByLanguage && pose.breathingPatternLabelsByLanguage[normalizeResultLanguage(language)]
      ? pose.breathingPatternLabelsByLanguage[normalizeResultLanguage(language)]
      : '-';
  }

  function getQuestionSparql(questionId, language) {
    if (global.SNEducationData && typeof global.SNEducationData.getQuestionSparql === 'function') {
      return global.SNEducationData.getQuestionSparql(questionId, language);
    }
    var question = getQuestionById(questionId);
    return question ? question.sparql : '';
  }

  function getBaseVariant(model) {
    return model && typeof model.getBaseVariant === 'function' ? model.getBaseVariant() : null;
  }

  function getBasePoses(model) {
    var baseVariant = getBaseVariant(model);
    return baseVariant && typeof model.getOrderedPosesForVariant === 'function'
      ? model.getOrderedPosesForVariant(baseVariant)
      : [];
  }

  function getGuidedBasePoses(model) {
    return getBasePoses(model).filter(function (pose) {
      var guidance = model.getPoseGuidance(pose);
      return guidance && (guidance.rules.length || guidance.constraints.length || guidance.errors.length);
    });
  }

  function getAsanasWithVisuals(model) {
    return model && typeof model.getAsanasWithVisuals === 'function'
      ? model.getAsanasWithVisuals()
      : [];
  }

  function createVisualTableCell(asana) {
    if (!asana || !asana.visual) {
      return '-';
    }

    return {
      kind: 'cyp-visual',
      src: asana.visual.src,
      alt: asana.visual.alt,
      asanaLabel: asana.label,
      caption: asana.visual.caption,
      page: asana.cypPage
    };
  }

  function getStorage() {
    try {
      return global.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function saveApiKey(apiKey) {
    var storage = getStorage();
    if (!storage) {
      return;
    }
    if (compactText(apiKey)) {
      storage.setItem(STORAGE_KEY, compactText(apiKey));
      return;
    }
    storage.removeItem(STORAGE_KEY);
  }

  function loadApiKey() {
    var storage = getStorage();
    var storedKey = storage ? compactText(storage.getItem(STORAGE_KEY)) : '';
    var configuredKey = compactText(
      global.SNEducationLocalConfig && global.SNEducationLocalConfig.geminiApiKey
    );

    return storedKey || configuredKey || '';
  }

  function clearApiKey() {
    var storage = getStorage();
    if (storage) {
      storage.removeItem(STORAGE_KEY);
    }
  }

  function resolveAsana(model, rawLabel) {
    var target = normalizeKey(rawLabel);
    var exactMatch;
    var alternateMatch;
    var containsMatch;

    if (!target || !model || !model.asanas) {
      return null;
    }

    exactMatch = model.asanas.find(function (asana) {
      return normalizeKey(asana.label) === target;
    });
    if (exactMatch) {
      return exactMatch;
    }

    alternateMatch = model.asanas.find(function (asana) {
      return (asana.alternateNames || []).some(function (alternateName) {
        return normalizeKey(alternateName) === target;
      });
    });
    if (alternateMatch) {
      return alternateMatch;
    }

    containsMatch = model.asanas.find(function (asana) {
      return normalizeKey(asana.label).indexOf(target) !== -1 ||
        target.indexOf(normalizeKey(asana.label)) !== -1;
    });

    return containsMatch || null;
  }

  function expandAliasTexts(value) {
    var text = compactText(value);
    var normalizedText = compactText(text.replace(/[_#]+/g, ' '));

    return unique([text, normalizedText].filter(Boolean));
  }

  function getVariantAliases(variant) {
    var aliases = [];
    var combinedText;
    var variantNumberMatch;

    if (!variant) {
      return [];
    }

    aliases = aliases
      .concat(expandAliasTexts(variant.id))
      .concat(expandAliasTexts(variant.label))
      .concat(expandAliasTexts(variant.displayLabel));

    combinedText = normalizeKey([
      variant.id,
      variant.label,
      variant.displayLabel
    ].join(' '));

    variantNumberMatch = /variant\s*0*([1-9]\d*)/.exec(combinedText);
    if (variantNumberMatch) {
      aliases.push(
        'variant ' + variantNumberMatch[1],
        'variant0' + variantNumberMatch[1],
        'variant0' + variantNumberMatch[1],
        'variant' + variantNumberMatch[1],
        'v' + variantNumberMatch[1]
      );
    }

    if (combinedText.indexOf('basesn') !== -1 || combinedText.indexOf('base sn') !== -1) {
      aliases.push(
        'base',
        'base sn',
        'base surya namaskar',
        'sivananda',
        'iit bhu',
        'sivananda yoga vedanta centre'
      );
    }

    return unique(aliases.map(function (alias) {
      return normalizeKey(alias);
    }).filter(Boolean));
  }

  function textContainsAlias(text, alias) {
    if (!text || !alias) {
      return false;
    }

    if (alias.length <= 3 || /^v\d+$/.test(alias) || /^variant\s*0*\d+$/.test(alias)) {
      return new RegExp('(^|[^a-z0-9])' + escapeRegExp(alias) + '([^a-z0-9]|$)').test(text);
    }

    return text.indexOf(alias) !== -1;
  }

  function resolveVariant(model, rawLabel) {
    var target = normalizeKey(rawLabel);
    var exactMatch;
    var aliasMatch;
    var containsMatch;

    if (!target || !model || !model.variants) {
      return null;
    }

    exactMatch = model.variants.find(function (variant) {
      return normalizeKey(variant.label) === target ||
        normalizeKey(variant.displayLabel) === target;
    });
    if (exactMatch) {
      return exactMatch;
    }

    aliasMatch = model.variants.find(function (variant) {
      return getVariantAliases(variant).some(function (alias) {
        return alias === target;
      });
    });
    if (aliasMatch) {
      return aliasMatch;
    }

    containsMatch = model.variants.find(function (variant) {
      return getVariantAliases(variant).some(function (alias) {
        return alias.length > 3 && (alias.indexOf(target) !== -1 || target.indexOf(alias) !== -1);
      });
    });

    return containsMatch || null;
  }

  function resolveVariantsFromQuestion(model, questionText) {
    var text = normalizeKey(questionText);

    if (!text || !model || !model.variants) {
      return [];
    }

    return model.variants.filter(function (variant) {
      return getVariantAliases(variant).some(function (alias) {
        return textContainsAlias(text, alias);
      });
    });
  }

  function resolveAsanaFromQuestion(model, questionText) {
    var text = normalizeKey(questionText);
    var candidates = [];

    if (!text || !model || !model.asanas) {
      return null;
    }

    model.asanas.forEach(function (asana) {
      var aliases = [asana.label].concat(asana.alternateNames || []);

      aliases.forEach(function (alias) {
        var normalizedAlias = normalizeKey(alias);
        if (!normalizedAlias) {
          return;
        }
        if (textContainsAlias(text, normalizedAlias)) {
          candidates.push({
            asana: asana,
            matchLength: normalizedAlias.length
          });
        }
      });
    });

    candidates.sort(function (left, right) {
      return right.matchLength - left.matchLength || left.asana.label.localeCompare(right.asana.label);
    });

    return candidates.length ? candidates[0].asana : null;
  }

  function findBasePoseByNumber(model, poseNumber) {
    return getBasePoses(model).find(function (pose) {
      return Number(pose.poseNumber) === Number(poseNumber);
    }) || null;
  }

  function findBasePoseByAsana(model, asanaLabel) {
    var resolvedAsana = resolveAsana(model, asanaLabel);
    var exactPose;
    var fuzzyPose;

    if (!asanaLabel) {
      return null;
    }

    if (resolvedAsana) {
      exactPose = getBasePoses(model).find(function (pose) {
        return pose.asanaUri === resolvedAsana.uri;
      });
      if (exactPose) {
        return exactPose;
      }
    }

    fuzzyPose = getBasePoses(model).find(function (pose) {
      return normalizeKey(pose.asanaLabel) === normalizeKey(asanaLabel) ||
        normalizeKey(pose.asanaLabel).indexOf(normalizeKey(asanaLabel)) !== -1 ||
        normalizeKey(asanaLabel).indexOf(normalizeKey(pose.asanaLabel)) !== -1;
    });

    return fuzzyPose || null;
  }

  function serializeContextList(items, mapFn) {
    return items.map(mapFn).filter(Boolean).join('\n');
  }

  function buildVariantContext(model) {
    var variants = model && model.variants ? model.variants : [];

    return serializeContextList(variants, function (variant) {
      var poses = model.getOrderedPosesForVariant ? model.getOrderedPosesForVariant(variant) : [];
      var distinctAsanas = unique(poses.map(function (pose) {
        return pose.asanaLabel;
      }).filter(Boolean));

      return '- ' + variant.displayLabel + ': ' + poses.length + ' poses, ' + distinctAsanas.length + ' distinct asanas';
    }) || '- None';
  }

  function buildSharedAsanaContext(model) {
    var entries = model && typeof model.getSharedAsanas === 'function'
      ? model.getSharedAsanas(2).slice(0, 12)
      : [];

    return serializeContextList(entries, function (entry) {
      return '- ' + entry.asana.label + ': ' + entry.variants.map(function (variant) {
        return variant.displayLabel;
      }).join(', ');
    }) || '- None';
  }

  function buildOntologyContext(model) {
    var basePoses = getBasePoses(model);
    var guidedPoses = getGuidedBasePoses(model);
    var visualAsanas = getAsanasWithVisuals(model);
    var asanaLabels = (model.asanas || []).map(function (asana) {
      return asana.label;
    }).slice().sort(function (left, right) {
      return left.localeCompare(right);
    });

    return [
      'Base variant: Base Surya Namaskar (default instructional sequence in this workspace).',
      'Base poses:',
      serializeContextList(basePoses, function (pose) {
        return '- Pose ' + pose.poseNumber + ': ' + pose.asanaLabel +
          (pose.breathingPatternLabel ? ', breathing: ' + pose.breathingPatternLabel : '') +
          (pose.safetyNote ? ', safety: ' + pose.safetyNote : '');
      }),
      'Base poses with explicit guidance entities:',
      serializeContextList(guidedPoses, function (pose) {
        return '- Pose ' + pose.poseNumber + ': ' + pose.asanaLabel;
      }) || '- None',
      'Variants in the loaded ontology:',
      buildVariantContext(model),
      'Examples of asanas shared across variants:',
      buildSharedAsanaContext(model),
      'Asanas with linked CYP pages:',
      serializeContextList(visualAsanas, function (asana) {
        return '- ' + asana.label + ': page ' + asana.cypPage;
      }) || '- None',
      'Known asana labels:',
      asanaLabels.join(', ')
    ].join('\n');
  }

  function buildPlannerPrompt(model, questionText) {
    return [
      'Supported intents:',
      '- base_sequence: ordered sequence of poses in Base Surya Namaskar.',
      '- base_breathing_safety: breathing pattern, inhale/exhale/hold, safety note, or precaution annotations across Base Surya Namaskar poses.',
      '- base_mantra_chakra: which Base Surya Namaskar poses have mantra and chakra annotations.',
      '- base_repeats: repeated poses on the return path in Base Surya Namaskar.',
      '- base_inverses: inverse left/right pose pairs in Base Surya Namaskar.',
      '- shared_asanas: asanas or poses common/shared across two or more variants; broad cross-variant overlap questions should map here and be answered at the asana identity level.',
      '- same_asana_equivalences: explicit sameAsanaAs links.',
      '- cyp_visual_references: linked CYP page visuals, optionally for a specific asana.',
      '- pose_guidance: guidance, rules, constraints, errors, corrections, or body parts for a specific Base Surya Namaskar pose or asana.',
      '- variant_pose_counts: how many poses each variant has, including comparisons across all or named variants, and questions asking what the different variants are.',
      '- variant_sequence: the ordered pose sequence for one or more named variants.',
      '- asana_variant_coverage: which variants include a specific asana, and at which pose numbers it appears.',
      '- unsupported: anything else.',
      'Ontology context:',
      buildOntologyContext(model),
      'User question:',
      compactText(questionText),
      'Return JSON only.'
    ].join('\n\n');
  }

  function buildExplanationEvidence(questionText, session, execution) {
    return {
      question: questionText,
      template: session.templateLabel,
      intent: session.plan.intent,
      language: session.language || session.plan.language || 'hi',
      sparql: session.sparql,
      facts: execution.answer.facts || [],
      table: execution.answer.table || null,
      sections: execution.answer.sections || [],
      visuals: (execution.answer.visuals || []).map(function (visual) {
        return {
          asanaLabel: visual.asanaLabel,
          page: visual.page,
          caption: visual.caption
        };
      })
    };
  }

  function buildExplanationPrompt(questionText, session, execution) {
    var evidence = buildExplanationEvidence(questionText, session, execution);

    return [
      'Student question:',
      compactText(questionText),
      'Evidence JSON:',
      JSON.stringify(evidence, null, 2),
      'Write a grounded educational explanation in one or two short paragraphs.',
      'Mention linked CYP visuals only if they are present in the evidence.',
      'Return only the final explanation. Do not include notes, bullets, self-checks, reasoning, or prompt restatement.'
    ].join('\n\n');
  }

  function buildGemmaExplanationPrompt(questionText, session, execution) {
    var evidence = buildExplanationEvidence(questionText, session, execution);

    return [
      'You are writing a grounded educational explanation for a Surya Namaskar ontology workspace.',
      'Use only the supplied evidence JSON.',
      'Do not invent pose counts, relations, or visual page references that are not present in the evidence JSON.',
      'If the evidence is limited, say so briefly instead of speculating.',
      'Use plain teaching language.',
      'Write one or two short paragraphs in the value of the "answer" field.',
      'Mention linked CYP visuals only if they are present in the evidence.',
      'Return only valid JSON matching this schema: {"answer":"string"}.',
      'Do not include markdown, code fences, notes, bullets, self-checks, reasoning, prompt restatement, or any keys other than "answer".',
      'Student question:',
      compactText(questionText),
      'Evidence JSON:',
      JSON.stringify(evidence, null, 2)
    ].join('\n\n');
  }

  function tryParseExplanationObject(text) {
    var raw = String(text || '').trim();
    var candidates = [
      raw,
      raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, ''),
      raw.replace(/^```\s*/i, '').replace(/\s*```$/i, '')
    ];
    var parsed = null;

    candidates.some(function (candidate) {
      try {
        parsed = JSON.parse(candidate);
        return true;
      } catch (error) {
        return false;
      }
    });

    return parsed;
  }

  function findExplanationObject(text) {
    var raw = String(text || '');
    var start = -1;
    var depth = 0;
    var inString = false;
    var escaped = false;
    var index;
    var char;
    var candidate;
    var parsed;

    for (index = 0; index < raw.length; index += 1) {
      char = raw.charAt(index);

      if (start === -1) {
        if (char === '{') {
          start = index;
          depth = 1;
          inString = false;
          escaped = false;
        }
        continue;
      }

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        depth += 1;
        continue;
      }

      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          candidate = raw.slice(start, index + 1);
          parsed = tryParseExplanationObject(candidate);
          if (parsed && typeof parsed.answer === 'string') {
            return parsed;
          }
          start = -1;
        }
      }
    }

    return null;
  }

  function extractGeminiText(payload, preserveWhitespace) {
    var candidates = payload && payload.candidates ? payload.candidates : [];
    var texts = [];

    candidates.forEach(function (candidate) {
      var parts = candidate && candidate.content && candidate.content.parts
        ? candidate.content.parts
        : [];

      parts.forEach(function (part) {
        if (typeof part.text === 'string') {
          texts.push(part.text);
        }
      });
    });

    return preserveWhitespace ? texts.join('\n').trim() : compactText(texts.join('\n'));
  }

  function extractGemmaExplanationText(text) {
    var raw = String(text || '').trim();
    var parsedObject = tryParseExplanationObject(raw) || findExplanationObject(raw);
    var match = raw.match(/<final_explanation>([\s\S]*?)<\/final_explanation>/i);
    var escapedMatch = raw.match(/&lt;final_explanation&gt;([\s\S]*?)&lt;\/final_explanation&gt;/i);
    var openTagIndex;
    var escapedOpenTagIndex;
    var trailingText;
    var filteredLines;

    if (parsedObject && typeof parsedObject.answer === 'string') {
      return compactText(parsedObject.answer);
    }

    if (match) {
      return compactText(match[1]);
    }

    if (escapedMatch) {
      return compactText(escapedMatch[1]);
    }

    openTagIndex = raw.toLowerCase().lastIndexOf('<final_explanation>');
    if (openTagIndex !== -1) {
      trailingText = raw.slice(openTagIndex + '<final_explanation>'.length);
      trailingText = trailingText.replace(/<\/final_explanation>\s*$/i, '');
      trailingText = compactText(trailingText);
      if (trailingText) {
        return trailingText;
      }
    }

    escapedOpenTagIndex = raw.toLowerCase().lastIndexOf('&lt;final_explanation&gt;');
    if (escapedOpenTagIndex !== -1) {
      trailingText = raw.slice(escapedOpenTagIndex + '&lt;final_explanation&gt;'.length);
      trailingText = trailingText.replace(/&lt;\/final_explanation&gt;\s*$/i, '');
      trailingText = compactText(trailingText);
      if (trailingText) {
        return trailingText;
      }
    }

    filteredLines = raw
      .split(/\n+/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean)
      .filter(function (line) {
        return !/^Explanation:\s*$/i.test(line) &&
          !/^\*\s*(User Question|Evidence|Constraints|Visuals|Draft|Concise\?|Educational\?|Only supplied evidence\?|No invented counts\?|Plain teaching language\?|Text only\?|No bullets\?|Visuals included\?)/i.test(line);
      });

    return compactText(filteredLines.join(' ')).replace(/^Explanation:\s*/i, '');
  }

  function requestGemini(apiKey, modelName, body) {
    return fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(modelName || DEFAULT_MODEL) +
      ':generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': compactText(apiKey)
        },
        body: JSON.stringify(body)
      }
    ).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        var message;

        if (!response.ok) {
          message = payload && payload.error && payload.error.message
            ? payload.error.message
            : 'Gemini request failed (' + response.status + ').';
          throw new Error(message);
        }

        return payload;
      });
    });
  }

  function requestStructuredPlan(options) {
    return requestGemini(options.apiKey, options.modelName, {
      systemInstruction: {
        parts: [
          { text: PLANNER_SYSTEM_PROMPT }
        ]
      },
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildPlannerPrompt(options.model, options.questionText) }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: PLANNER_SCHEMA,
        temperature: 0,
        candidateCount: 1
      }
    }).then(function (payload) {
      var text = extractGeminiText(payload);
      var parsed;

      if (!text) {
        throw new Error('Gemini returned an empty planning response.');
      }

      try {
        parsed = JSON.parse(text);
      } catch (error) {
        throw new Error('Gemini returned invalid planner JSON.');
      }

      return parsed;
    });
  }

  function requestExplanation(options) {
    var modelName = compactText(options.modelName) || DEFAULT_MODEL;
    var gemmaMode = isGemmaModel(modelName);
    var requestBody = gemmaMode ? {
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildGemmaExplanationPrompt(options.questionText, options.session, options.execution) }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: EXPLANATION_SCHEMA,
        temperature: 0.2,
        candidateCount: 1
      }
    } : {
      systemInstruction: {
        parts: [
          { text: EXPLANATION_SYSTEM_PROMPT }
        ]
      },
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildExplanationPrompt(options.questionText, options.session, options.execution) }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        candidateCount: 1
      }
    };

    return requestGemini(options.apiKey, modelName, requestBody).then(function (payload) {
      var text = extractGeminiText(payload, gemmaMode);

      if (gemmaMode) {
        text = extractGemmaExplanationText(text);
      }

      if (!text) {
        throw new Error('Gemini returned an empty explanation.');
      }

      return text;
    });
  }

  function sanitizePlan(rawPlan) {
    var plan = rawPlan || {};
    var intent = SUPPORTED_INTENTS.indexOf(plan.intent) !== -1 ? plan.intent : 'unsupported';
    var poseNumber = plan.poseNumber === null || plan.poseNumber === undefined || plan.poseNumber === ''
      ? null
      : Number(plan.poseNumber);

    return {
      intent: intent,
      confidence: Math.max(0, Math.min(1, Number(plan.confidence) || 0)),
      normalizedQuestion: compactText(plan.normalizedQuestion),
      asanaLabel: compactText(plan.asanaLabel) || null,
      variantLabel: compactText(plan.variantLabel) || null,
      poseNumber: Number.isFinite(poseNumber) ? poseNumber : null,
      wantsVisuals: Boolean(plan.wantsVisuals),
      rationale: compactText(plan.rationale),
      unsupportedReason: compactText(plan.unsupportedReason) || null
    };
  }

  function looksLikeSharedAcrossVariantsQuestion(questionText) {
    var text = normalizeKey(questionText);

    return text.indexOf('variant') !== -1 &&
      /(common|shared|overlap|overlapping|across|present in multiple|present across|same across)/.test(text) &&
      /(pose|poses|asana|asanas)/.test(text);
  }

  function looksLikeVariantPoseCountQuestion(questionText) {
    var text = normalizeKey(questionText);

    return /(variant|variants|base surya namaskar|krishnamacharya|bihar school of yoga|swami vivekananda kendra|sivananda)/.test(text) &&
      /(how many|number of|count|counts|compare|comparison|more|fewer|least|most|total)/.test(text) &&
      /\bpose\b|\bposes\b/.test(text);
  }

  function looksLikeVariantCatalogQuestion(questionText) {
    var text = normalizeKey(questionText);

    return /(variant|variants|sn|surya namaskar)/.test(text) &&
      /(different variants|what are the variants|which variants|list.*variants|variants of sn|variants of surya namaskar|types of sn|types of surya namaskar)/.test(text);
  }

  function looksLikeVariantSequenceQuestion(questionText) {
    var text = normalizeKey(questionText);

    return /(variant|variants|base surya namaskar|krishnamacharya|bihar school of yoga|swami vivekananda kendra|sivananda)/.test(text) &&
      /(sequence|ordered|order|pose list|list the poses|poses in|poses of)/.test(text);
  }

  function looksLikeBreathingSafetyQuestion(questionText) {
    var text = normalizeKey(questionText);

    return /(breath|breathing|inhale|exhale|hold|safety|safe|precaution|careful|note|notes)/.test(text) &&
      /(base|surya namaskar|sn|pose|poses|sequence)/.test(text);
  }

  function looksLikeAsanaVariantCoverageQuestion(questionText) {
    var text = normalizeKey(questionText);

    return /(variant|variants)/.test(text) &&
      /(which|what|where|include|includes|included|appear|appears|present|contains|contain)/.test(text);
  }

  function setResolvedVariantsOnPlan(model, questionText, resolvedPlan) {
    var explicitVariant = resolvedPlan.variantLabel ? resolveVariant(model, resolvedPlan.variantLabel) : null;
    var mentionedVariants = resolveVariantsFromQuestion(model, questionText);
    var variants = explicitVariant
      ? [explicitVariant].concat(mentionedVariants.filter(function (variant) {
        return variant.uri !== explicitVariant.uri;
      }))
      : mentionedVariants;

    resolvedPlan.variantUris = variants.map(function (variant) {
      return variant.uri;
    });
    resolvedPlan.variantLabels = variants.map(function (variant) {
      return variant.displayLabel;
    });

    if (!resolvedPlan.variantLabel && variants.length === 1) {
      resolvedPlan.variantLabel = variants[0].displayLabel;
    }
  }

  function resolvePlanAgainstModel(model, questionText, plan) {
    var resolvedPlan = sanitizePlan(plan);
    var resolvedAsana;
    var resolvedPose;
    var inferredAsana;

    setResolvedVariantsOnPlan(model, questionText, resolvedPlan);

    if (resolvedPlan.intent === 'unsupported' && looksLikeSharedAcrossVariantsQuestion(questionText)) {
      resolvedPlan.intent = 'shared_asanas';
      resolvedPlan.confidence = Math.max(resolvedPlan.confidence, 0.6);
      resolvedPlan.asanaLabel = null;
      resolvedPlan.poseNumber = null;
      resolvedPlan.unsupportedReason = null;
      resolvedPlan.rationale = 'The question asks for what is common across variants, which maps to the shared_asanas template. Cross-variant overlap is answered at the asana identity level.';
    }

    if (looksLikeBreathingSafetyQuestion(questionText)) {
      resolvedPlan.intent = 'base_breathing_safety';
      resolvedPlan.confidence = Math.max(resolvedPlan.confidence, 0.74);
      resolvedPlan.poseNumber = null;
      resolvedPlan.unsupportedReason = null;
      resolvedPlan.rationale = 'The question asks for breathing or safety annotations, which are currently modeled on the Base Surya Namaskar poses.';
    }

    if (resolvedPlan.asanaLabel) {
      resolvedAsana = resolveAsana(model, resolvedPlan.asanaLabel);
      if (resolvedAsana) {
        resolvedPlan.asanaLabel = resolvedAsana.label;
      }
    } else {
      inferredAsana = resolveAsanaFromQuestion(model, questionText);
      if (inferredAsana) {
        resolvedPlan.asanaLabel = inferredAsana.label;
      }
    }

    if (looksLikeVariantCatalogQuestion(questionText)) {
      resolvedPlan.intent = 'variant_pose_counts';
      resolvedPlan.confidence = Math.max(resolvedPlan.confidence, 0.72);
      resolvedPlan.poseNumber = null;
      resolvedPlan.unsupportedReason = null;
      resolvedPlan.rationale = 'The question asks which Surya Namaskar variants are modeled, so the variant pose count template is used to list the variants with their pose counts.';
    } else if (looksLikeVariantPoseCountQuestion(questionText)) {
      resolvedPlan.intent = 'variant_pose_counts';
      resolvedPlan.confidence = Math.max(resolvedPlan.confidence, 0.72);
      resolvedPlan.poseNumber = null;
      resolvedPlan.unsupportedReason = null;
      resolvedPlan.rationale = 'The question asks about the number of poses across variants, which maps to a variant pose count comparison.';
    } else if (looksLikeVariantSequenceQuestion(questionText) && resolvedPlan.variantUris.length) {
      resolvedPlan.intent = 'variant_sequence';
      resolvedPlan.confidence = Math.max(resolvedPlan.confidence, 0.7);
      resolvedPlan.poseNumber = null;
      resolvedPlan.unsupportedReason = null;
      resolvedPlan.rationale = 'The question asks for an ordered pose sequence for one or more named variants.';
    } else if (looksLikeAsanaVariantCoverageQuestion(questionText) && resolvedPlan.asanaLabel) {
      resolvedPlan.intent = 'asana_variant_coverage';
      resolvedPlan.confidence = Math.max(resolvedPlan.confidence, 0.68);
      resolvedPlan.poseNumber = null;
      resolvedPlan.unsupportedReason = null;
      resolvedPlan.rationale = 'The question asks which variants include a specific asana.';
    }

    if (resolvedPlan.intent === 'pose_guidance') {
      resolvedPose = resolvedPlan.poseNumber
        ? findBasePoseByNumber(model, resolvedPlan.poseNumber)
        : null;

      if (!resolvedPose && resolvedPlan.asanaLabel) {
        resolvedPose = findBasePoseByAsana(model, resolvedPlan.asanaLabel);
      }

      if (!resolvedPose && resolvedPlan.asanaLabel) {
        resolvedAsana = resolveAsana(model, resolvedPlan.asanaLabel);
        if (resolvedAsana) {
          resolvedPlan.asanaLabel = resolvedAsana.label;
        }
      }

      if (resolvedPose) {
        resolvedPlan.poseNumber = resolvedPose.poseNumber;
        resolvedPlan.asanaLabel = resolvedPose.asanaLabel;
      } else {
        throw new Error(
          'The ontology planner could not resolve a Base Surya Namaskar pose from: "' +
          compactText(questionText) + '".'
        );
      }
    }

    if (resolvedPlan.intent === 'variant_pose_counts' && !resolvedPlan.variantUris.length) {
      resolvedPlan.variantUris = (model.variants || []).map(function (variant) {
        return variant.uri;
      });
      resolvedPlan.variantLabels = (model.variants || []).map(function (variant) {
        return variant.displayLabel;
      });
    }

    if (resolvedPlan.intent === 'variant_sequence' && !resolvedPlan.variantUris.length) {
      throw new Error(
        'The ontology planner could not resolve which variant sequence to use from: "' +
        compactText(questionText) + '".'
      );
    }

    if (resolvedPlan.intent === 'asana_variant_coverage' && !resolvedPlan.asanaLabel) {
      throw new Error(
        'The ontology planner could not resolve which asana to compare across variants from: "' +
        compactText(questionText) + '".'
      );
    }

    return resolvedPlan;
  }

  function buildVariantValuesClause(variantUris) {
    if (!variantUris || !variantUris.length) {
      return '';
    }

    return '  VALUES ?variant { ' + variantUris.map(function (uri) {
      return '<' + uri + '>';
    }).join(' ') + ' }\n';
  }

  function getLanguageValueClause(language) {
    return '  VALUES ?selectedLanguage { "' + normalizeResultLanguage(language) + '" }\n';
  }

  function getAsanaLabelPattern(asanaVariable, englishLabelVariable, selectedLabelVariable) {
    return '  ' + asanaVariable + ' rdfs:label ' + englishLabelVariable + ' .\n' +
      '  FILTER (LANGMATCHES(LANG(' + englishLabelVariable + '), "en"))\n' +
      '  OPTIONAL {\n' +
      '    ' + asanaVariable + ' rdfs:label ' + selectedLabelVariable + ' .\n' +
      '    FILTER (LANGMATCHES(LANG(' + selectedLabelVariable + '), ?selectedLanguage))\n' +
      '  }\n';
  }

  function getBreathingLabelPattern(breathingVariable, englishLabelVariable, selectedLabelVariable) {
    return '  ' + breathingVariable + ' rdfs:label ' + englishLabelVariable + ' .\n' +
      '  FILTER (LANGMATCHES(LANG(' + englishLabelVariable + '), "en"))\n' +
      '  OPTIONAL {\n' +
      '    ' + breathingVariable + ' rdfs:label ' + selectedLabelVariable + ' .\n' +
      '    FILTER (LANGMATCHES(LANG(' + selectedLabelVariable + '), ?selectedLanguage))\n' +
      '  }\n';
  }

  function buildVisualReferenceSparql(asanaLabel, language) {
    var filter = asanaLabel
      ? '\n  FILTER (LCASE(STR(?asanaLabel)) = "' + escapeSparqlString(normalizeKey(asanaLabel)) + '")'
      : '';

    return withPrefixes(
      'SELECT ?asanaLabel ?asanaLabelSelected ?cypPage\n' +
      'WHERE {\n' +
      getLanguageValueClause(language) +
      '  ?asana rdf:type core:Asana ;\n' +
      '         core:hasCYPPage ?cypPage .\n' +
      getAsanaLabelPattern('?asana', '?asanaLabel', '?asanaLabelSelected') +
      filter + '\n' +
      '}\n' +
      'ORDER BY ?cypPage ?asanaLabel'
    );
  }

  function buildPoseGuidanceSparql(pose, language) {
    return withPrefixes(
      'SELECT ?poseNumber ?asanaLabel ?asanaLabelSelected ?breathingLabel ?breathingLabelSelected ?safetyNote ?ruleDescription ?constraintDescription ?errorDescription ?correctionText\n' +
      'WHERE {\n' +
      getLanguageValueClause(language) +
      '  BIND(base:' + pose.id + ' AS ?pose)\n' +
      '  ?pose core:poseNumber ?poseNumber ;\n' +
      '        core:hasAsana ?asana .\n' +
      getAsanaLabelPattern('?asana', '?asanaLabel', '?asanaLabelSelected') +
      '  OPTIONAL {\n' +
      '    ?pose core:hasBreathingPattern ?breathing .\n' +
      getBreathingLabelPattern('?breathing', '?breathingLabel', '?breathingLabelSelected') +
      '  }\n' +
      '  OPTIONAL { ?pose core:hasSafetyNote ?safetyNote . }\n' +
      '  OPTIONAL { ?pose core:hasRule ?rule . ?rule core:ruleDescription ?ruleDescription . }\n' +
      '  OPTIONAL { ?pose core:hasConstraint ?constraint . ?constraint core:constraintDescription ?constraintDescription . }\n' +
      '  OPTIONAL {\n' +
      '    ?pose core:hasPossibleError ?error .\n' +
      '    ?error core:errorDescription ?errorDescription .\n' +
      '    OPTIONAL {\n' +
      '      ?error core:hasCorrection ?correction .\n' +
      '      ?correction core:correctionText ?correctionText .\n' +
      '    }\n' +
      '  }\n' +
      '}\n' +
      'ORDER BY ?poseNumber ?ruleDescription ?errorDescription ?correctionText'
    );
  }

  function buildVariantPoseCountSparql(plan) {
    return withPrefixes(
      'SELECT ?variantLabel (COUNT(DISTINCT ?pose) AS ?poseCount) (COUNT(DISTINCT ?asana) AS ?distinctAsanaCount)\n' +
      'WHERE {\n' +
      buildVariantValuesClause(plan.variantUris) +
      '  ?pose rdf:type core:Pose ;\n' +
      '        core:belongsToVariant ?variant ;\n' +
      '        core:hasAsana ?asana .\n' +
      '  ?variant rdfs:label ?variantLabel .\n' +
      '}\n' +
      'GROUP BY ?variantLabel\n' +
      'ORDER BY DESC(?poseCount) ?variantLabel'
    );
  }

  function buildVariantSequenceSparql(plan, language) {
    return withPrefixes(
      'SELECT ?variantLabel ?poseNumber ?asanaLabel ?asanaLabelSelected ?breathingLabel ?breathingLabelSelected ?laterality ?supportType ?chakra ?mantra ?safetyNote\n' +
      'WHERE {\n' +
      getLanguageValueClause(language) +
      buildVariantValuesClause(plan.variantUris) +
      '  ?pose rdf:type core:Pose ;\n' +
      '        core:belongsToVariant ?variant ;\n' +
      '        core:poseNumber ?poseNumber ;\n' +
      '        core:hasAsana ?asana .\n' +
      '  ?variant rdfs:label ?variantLabel .\n' +
      '  FILTER (LANGMATCHES(LANG(?variantLabel), "en"))\n' +
      getAsanaLabelPattern('?asana', '?asanaLabel', '?asanaLabelSelected') +
      '  OPTIONAL {\n' +
      '    ?pose core:hasBreathingPattern ?breathing .\n' +
      getBreathingLabelPattern('?breathing', '?breathingLabel', '?breathingLabelSelected') +
      '  }\n' +
      '  OPTIONAL { ?pose core:hasLaterality ?laterality . }\n' +
      '  OPTIONAL { ?pose core:hasSupportType ?supportType . }\n' +
      '  OPTIONAL { ?pose core:hasChakra ?chakra . }\n' +
      '  OPTIONAL { ?pose core:hasMantra ?mantra . }\n' +
      '  OPTIONAL { ?pose core:hasSafetyNote ?safetyNote . }\n' +
      '}\n' +
      'ORDER BY ?variantLabel ?poseNumber'
    );
  }

  function buildAsanaVariantCoverageSparql(plan, language) {
    return withPrefixes(
      'SELECT ?asanaLabel ?asanaLabelSelected ?variantLabel ?poseNumber ?laterality ?supportType\n' +
      'WHERE {\n' +
      getLanguageValueClause(language) +
      '  ?pose rdf:type core:Pose ;\n' +
      '        core:belongsToVariant ?variant ;\n' +
      '        core:poseNumber ?poseNumber ;\n' +
      '        core:hasAsana ?asana .\n' +
      '  ?variant rdfs:label ?variantLabel .\n' +
      '  FILTER (LANGMATCHES(LANG(?variantLabel), "en"))\n' +
      getAsanaLabelPattern('?asana', '?asanaLabel', '?asanaLabelSelected') +
      '  FILTER (LCASE(STR(?asanaLabel)) = "' + escapeSparqlString(normalizeKey(plan.asanaLabel)) + '")\n' +
      '  OPTIONAL { ?pose core:hasLaterality ?laterality . }\n' +
      '  OPTIONAL { ?pose core:hasSupportType ?supportType . }\n' +
      '}\n' +
      'ORDER BY ?variantLabel ?poseNumber'
    );
  }

  function buildSparqlFromPlan(model, plan, language) {
    var predefinedQuestion;
    var selectedLanguage = normalizeResultLanguage(language || (plan && plan.language));
    var pose;

    if (INTENT_TO_QUESTION_ID[plan.intent]) {
      predefinedQuestion = getQuestionById(INTENT_TO_QUESTION_ID[plan.intent]);
      return predefinedQuestion ? getQuestionSparql(INTENT_TO_QUESTION_ID[plan.intent], selectedLanguage) : '';
    }

    if (plan.intent === 'cyp_visual_references') {
      return buildVisualReferenceSparql(plan.asanaLabel, selectedLanguage);
    }

    if (plan.intent === 'pose_guidance') {
      pose = findBasePoseByNumber(model, plan.poseNumber) || findBasePoseByAsana(model, plan.asanaLabel);
      if (!pose) {
        throw new Error('Unable to locate the requested base pose for guidance.');
      }
      return buildPoseGuidanceSparql(pose, selectedLanguage);
    }

    if (plan.intent === 'variant_pose_counts') {
      return buildVariantPoseCountSparql(plan);
    }

    if (plan.intent === 'variant_sequence') {
      return buildVariantSequenceSparql(plan, selectedLanguage);
    }

    if (plan.intent === 'asana_variant_coverage') {
      return buildAsanaVariantCoverageSparql(plan, selectedLanguage);
    }

    return '';
  }

  function cloneAnswer(answer) {
    return JSON.parse(JSON.stringify(answer || {}));
  }

  function executeDefaultQuestion(model, questionId, questionText, sparql, templateLabel, language) {
    var question = getQuestionById(questionId);
    var answer;

    if (!question || typeof question.run !== 'function') {
      throw new Error('Missing question template for ' + questionId + '.');
    }

    answer = cloneAnswer(question.run(model, {
      language: normalizeResultLanguage(language)
    }));
    answer.prompt = compactText(questionText) || question.prompt;

    if (questionId === 'shared-asanas' && /\bpose\b|\bposes\b/i.test(questionText)) {
      answer.narrative += ' This cross-variant comparison is answered at the asana identity level, because numbered poses are specific to each variant sequence.';
    }

    return {
      prompt: compactText(questionText) || question.prompt,
      badgeLabel: 'AI',
      sparql: sparql || question.sparql || '',
      templateLabel: templateLabel,
      answer: answer
    };
  }

  function buildPoseGuidanceAnswer(model, questionText, sparql, templateLabel, plan, language) {
    var pose = findBasePoseByNumber(model, plan.poseNumber) || findBasePoseByAsana(model, plan.asanaLabel);
    var guidance = pose ? model.getPoseGuidance(pose) : null;
    var selectedLanguage = normalizeResultLanguage(language || plan.language);
    var errorItems;
    var rows;

    if (!guidance) {
      throw new Error('No pose guidance data is available for that Base Surya Namaskar pose.');
    }

    errorItems = guidance.errors.map(function (error) {
      var correctionText = error.corrections.map(function (correction) {
        return correction.text || correction.label;
      });

      return (error.description || error.label) + (correctionText.length
        ? ' Correction: ' + joinList(correctionText) + '.'
        : '');
    });

    rows = []
      .concat(guidance.rules.map(function (rule) {
        return ['Rule', rule.description || rule.label];
      }))
      .concat(guidance.constraints.map(function (constraint) {
        return ['Constraint', constraint.description || constraint.label];
      }))
      .concat(guidance.errors.map(function (error) {
        return ['Error', error.description || error.label];
      }))
      .concat(guidance.corrections.map(function (correction) {
        return ['Correction', correction.text || correction.label];
      }))
      .concat(guidance.bodyParts.map(function (bodyPart) {
        return ['Body part', bodyPart.label];
      }));

    return {
      prompt: compactText(questionText),
      badgeLabel: 'AI',
      sparql: sparql,
      templateLabel: templateLabel,
      answer: {
        prompt: compactText(questionText),
        narrative: 'The ontology links Base Pose ' + guidance.pose.poseNumber + ' (' + guidance.pose.asanaLabel +
          ') to ' + guidance.rules.length + ' rule' + (guidance.rules.length === 1 ? '' : 's') + ', ' +
          guidance.constraints.length + ' constraint' + (guidance.constraints.length === 1 ? '' : 's') + ', and ' +
          guidance.errors.length + ' modeled error' + (guidance.errors.length === 1 ? '' : 's') + '.',
        facts: [
          { label: 'Pose', value: 'Pose ' + guidance.pose.poseNumber },
          { label: 'Asana', value: guidance.pose.asanaLabel },
          { label: getLanguageColumnLabel(selectedLanguage), value: getPoseAsanaLanguageLabel(guidance.pose, selectedLanguage) },
          { label: 'Breathing', value: guidance.pose.breathingPatternLabel || '-' },
          { label: 'Breathing (' + getLanguageOption(selectedLanguage).label + ')', value: getBreathingPatternLanguageLabel(guidance.pose, selectedLanguage) },
          { label: 'Safety note', value: guidance.pose.safetyNote || '-' },
          { label: 'Rules', value: String(guidance.rules.length) },
          { label: 'Constraints', value: String(guidance.constraints.length) },
          { label: 'Errors', value: String(guidance.errors.length) }
        ],
        table: rows.length ? {
          columns: ['Category', 'Detail'],
          rows: rows
        } : null,
        sections: [
          {
            title: 'Rules',
            items: guidance.rules.map(function (rule) {
              return rule.description || rule.label;
            })
          },
          {
            title: 'Constraints',
            items: guidance.constraints.map(function (constraint) {
              return constraint.description || constraint.label;
            })
          },
          {
            title: 'Errors And Corrections',
            items: errorItems
          },
          {
            title: 'Body Parts',
            items: guidance.bodyParts.map(function (bodyPart) {
              return bodyPart.label;
            })
          }
        ],
        visuals: guidance.visuals || []
      }
    };
  }

  function buildVisualReferenceAnswer(model, questionText, sparql, templateLabel, plan, language) {
    var question = getQuestionById('cyp-visual-references');
    var allAsanas;
    var resolvedAsana;
    var filteredAsanas;
    var selectedLanguage = normalizeResultLanguage(language || plan.language);

    if (!plan.asanaLabel || !question) {
      return executeDefaultQuestion(model, 'cyp-visual-references', questionText, sparql, templateLabel, selectedLanguage);
    }

    allAsanas = getAsanasWithVisuals(model);
    resolvedAsana = resolveAsana(model, plan.asanaLabel);
    filteredAsanas = allAsanas.filter(function (asana) {
      return resolvedAsana ? asana.uri === resolvedAsana.uri : normalizeKey(asana.label) === normalizeKey(plan.asanaLabel);
    });

    return {
      prompt: compactText(questionText),
      badgeLabel: 'AI',
      sparql: sparql,
      templateLabel: templateLabel,
      answer: {
        prompt: compactText(questionText),
        narrative: filteredAsanas.length
          ? filteredAsanas[0].label + ' is linked to CYP page ' + filteredAsanas[0].cypPage + ' in the current ontology snapshot.'
          : 'No linked CYP page is currently recorded for ' + plan.asanaLabel + ' in the ontology snapshot.',
        facts: [
          { label: 'Requested asana', value: resolvedAsana ? resolvedAsana.label : plan.asanaLabel },
          { label: getLanguageColumnLabel(selectedLanguage), value: resolvedAsana ? getRecordLanguageLabel(resolvedAsana, selectedLanguage) : '-' },
          { label: 'Matches', value: String(filteredAsanas.length) }
        ],
        table: {
          columns: ['Asana', getLanguageColumnLabel(selectedLanguage), 'CYP page', 'Image'],
          rows: filteredAsanas.map(function (asana) {
            return [
              asana.label,
              getRecordLanguageLabel(asana, selectedLanguage),
              String(asana.cypPage),
              createVisualTableCell(asana)
            ];
          })
        },
        sections: filteredAsanas.length ? [] : [
          {
            title: 'Current ontology state',
            items: [
              'The requested asana does not currently carry a hasCYPPage annotation in the loaded master.owl snapshot.'
            ]
          }
        ],
        visuals: model.collectVisualsFromAsanas(filteredAsanas)
      }
    };
  }

  function getPlanVariants(model, plan) {
    var variantUris = plan && plan.variantUris ? plan.variantUris : [];
    var resolvedVariants = variantUris.map(function (uri) {
      return model.getVariant(uri);
    }).filter(Boolean);

    if (resolvedVariants.length) {
      return resolvedVariants;
    }

    if (plan && plan.variantLabel) {
      return [resolveVariant(model, plan.variantLabel)].filter(Boolean);
    }

    return [];
  }

  function buildVariantPoseCountAnswer(model, questionText, sparql, templateLabel, plan, language) {
    var variants = getPlanVariants(model, plan);
    var selectedLanguage = normalizeResultLanguage(language || plan.language);
    var entries;
    var maxCount;
    var minCount;
    var topVariants;
    var bottomVariants;
    var allPoses;

    if (!variants.length) {
      variants = model.variants ? model.variants.slice() : [];
    }

    entries = variants.map(function (variant) {
      var poses = model.getOrderedPosesForVariant(variant);
      var distinctAsanas = unique(poses.map(function (pose) {
        return pose.asanaLabel;
      }).filter(Boolean));

      return {
        variant: variant,
        poses: poses,
        poseCount: poses.length,
        distinctAsanaCount: distinctAsanas.length,
        firstPose: poses[0] || null,
        lastPose: poses[poses.length - 1] || null
      };
    }).filter(function (entry) {
      return entry.poseCount > 0;
    }).sort(function (left, right) {
      return right.poseCount - left.poseCount ||
        left.variant.displayLabel.localeCompare(right.variant.displayLabel);
    });

    if (!entries.length) {
      throw new Error('No variant pose data is available in the loaded ontology.');
    }

    maxCount = entries[0].poseCount;
    minCount = entries[entries.length - 1].poseCount;
    topVariants = entries.filter(function (entry) {
      return entry.poseCount === maxCount;
    }).map(function (entry) {
      return entry.variant.displayLabel;
    });
    bottomVariants = entries.filter(function (entry) {
      return entry.poseCount === minCount;
    }).map(function (entry) {
      return entry.variant.displayLabel;
    });
    allPoses = entries.reduce(function (accumulator, entry) {
      return accumulator.concat(entry.poses);
    }, []);

    return {
      prompt: compactText(questionText),
      badgeLabel: 'AI',
      sparql: sparql,
      templateLabel: templateLabel,
      answer: {
        prompt: compactText(questionText),
        narrative: entries.length === 1
          ? entries[0].variant.displayLabel + ' is modeled with ' + entries[0].poseCount + ' poses and ' +
            entries[0].distinctAsanaCount + ' distinct asanas.'
          : 'Across ' + entries.length + ' compared variants, ' +
            joinList(entries.map(function (entry) {
              return entry.variant.displayLabel + ' (' + entry.poseCount + ' poses)';
            })) + '. The highest pose count is ' + maxCount + ' in ' + joinList(topVariants) +
            ', while the lowest is ' + minCount + ' in ' + joinList(bottomVariants) + '.',
        facts: [
          { label: 'Compared variants', value: String(entries.length) },
          { label: 'Highest pose count', value: String(maxCount) },
          { label: 'Lowest pose count', value: String(minCount) },
          { label: 'Pose spread', value: String(maxCount - minCount) }
        ],
        table: {
          columns: ['Variant', 'Pose count', 'Distinct asanas', 'First pose', 'First pose ' + getLanguageColumnLabel(selectedLanguage), 'Last pose', 'Last pose ' + getLanguageColumnLabel(selectedLanguage)],
          rows: entries.map(function (entry) {
            return [
              entry.variant.displayLabel,
              String(entry.poseCount),
              String(entry.distinctAsanaCount),
              entry.firstPose ? entry.firstPose.asanaLabel : '-',
              entry.firstPose ? getPoseAsanaLanguageLabel(entry.firstPose, selectedLanguage) : '-',
              entry.lastPose ? entry.lastPose.asanaLabel : '-',
              entry.lastPose ? getPoseAsanaLanguageLabel(entry.lastPose, selectedLanguage) : '-'
            ];
          })
        },
        sections: [],
        visuals: model.collectVisualsFromPoses(allPoses)
      }
    };
  }

  function buildVariantSequenceAnswer(model, questionText, sparql, templateLabel, plan, language) {
    var variants = getPlanVariants(model, plan);
    var selectedLanguage = normalizeResultLanguage(language || plan.language);
    var entries;
    var allPoses;

    if (!variants.length) {
      throw new Error('No variant sequence could be resolved from the question.');
    }

    entries = variants.map(function (variant) {
      var poses = model.getOrderedPosesForVariant(variant);
      var distinctAsanas = unique(poses.map(function (pose) {
        return pose.asanaLabel;
      }).filter(Boolean));

      return {
        variant: variant,
        poses: poses,
        distinctAsanas: distinctAsanas
      };
    }).filter(function (entry) {
      return entry.poses.length;
    });

    if (!entries.length) {
      throw new Error('The requested variant sequence is empty in the loaded ontology.');
    }

    allPoses = entries.reduce(function (accumulator, entry) {
      return accumulator.concat(entry.poses);
    }, []);

    return {
      prompt: compactText(questionText),
      badgeLabel: 'AI',
      sparql: sparql,
      templateLabel: templateLabel,
      answer: {
        prompt: compactText(questionText),
        narrative: entries.length === 1
          ? entries[0].variant.displayLabel + ' is modeled as ' + entries[0].poses.length + ' ordered poses: ' +
            entries[0].poses.map(poseSummary).join(' -> ') + '.'
          : 'The ontology returns ordered sequences for ' + joinList(entries.map(function (entry) {
            return entry.variant.displayLabel + ' (' + entry.poses.length + ' poses)';
          })) + '.',
        facts: [
          { label: 'Variants returned', value: String(entries.length) },
          { label: 'Total pose rows', value: String(allPoses.length) }
        ],
        table: {
          columns: ['Variant', '#', 'Asana', getLanguageColumnLabel(selectedLanguage), 'Breathing', 'Breathing (' + getLanguageOption(selectedLanguage).label + ')', 'Laterality', 'Support', 'Chakra', 'Mantra', 'Safety note'],
          rows: entries.reduce(function (accumulator, entry) {
            return accumulator.concat(entry.poses.map(function (pose) {
              return [
                entry.variant.displayLabel,
                String(pose.poseNumber),
                pose.asanaLabel,
                getPoseAsanaLanguageLabel(pose, selectedLanguage),
                pose.breathingPatternLabel || '-',
                getBreathingPatternLanguageLabel(pose, selectedLanguage),
                pose.laterality || '-',
                pose.supportType || '-',
                pose.chakra || '-',
                pose.mantra || '-',
                pose.safetyNote || '-'
              ];
            }));
          }, [])
        },
        sections: entries.length > 1 ? entries.map(function (entry) {
          return {
            title: entry.variant.displayLabel,
            items: entry.poses.map(poseSummary)
          };
        }) : [],
        visuals: model.collectVisualsFromPoses(allPoses)
      }
    };
  }

  function buildAsanaVariantCoverageAnswer(model, questionText, sparql, templateLabel, plan, language) {
    var asana = resolveAsana(model, plan.asanaLabel);
    var selectedLanguage = normalizeResultLanguage(language || plan.language);
    var poses;
    var grouped = {};
    var rows;
    var sectionItems;

    if (!asana) {
      throw new Error('The requested asana could not be resolved for variant coverage.');
    }

    poses = model.getPosesForAsana(asana);
    poses.forEach(function (pose) {
      var variant = model.getVariant(pose.variantUri);
      var key = variant ? variant.uri : pose.variantUri;

      if (!grouped[key]) {
        grouped[key] = {
          variant: variant,
          poses: []
        };
      }
      grouped[key].poses.push(pose);
    });

    rows = Object.keys(grouped).map(function (key) {
      var entry = grouped[key];
      entry.poses.sort(function (left, right) {
        return Number(left.poseNumber) - Number(right.poseNumber);
      });
      return entry;
    }).sort(function (left, right) {
      return left.variant.displayLabel.localeCompare(right.variant.displayLabel);
    });

    if (!rows.length) {
      throw new Error('No variant coverage was found for ' + asana.label + '.');
    }

    sectionItems = rows.map(function (entry) {
      return entry.variant.displayLabel + ': ' + joinList(entry.poses.map(function (pose) {
        return 'Pose ' + pose.poseNumber;
      }));
    });

    return {
      prompt: compactText(questionText),
      badgeLabel: 'AI',
      sparql: sparql,
      templateLabel: templateLabel,
      answer: {
        prompt: compactText(questionText),
        narrative: asana.label + ' appears in ' + rows.length + ' variant' + (rows.length === 1 ? '' : 's') +
          ': ' + joinList(sectionItems) + '.',
        facts: [
          { label: 'Asana', value: asana.label },
          { label: getLanguageColumnLabel(selectedLanguage), value: getRecordLanguageLabel(asana, selectedLanguage) },
          { label: 'Variants', value: String(rows.length) },
          { label: 'Total occurrences', value: String(poses.length) }
        ],
        table: {
          columns: ['Variant', 'Asana', getLanguageColumnLabel(selectedLanguage), 'Pose numbers', 'Occurrences'],
          rows: rows.map(function (entry) {
            return [
              entry.variant.displayLabel,
              asana.label,
              getRecordLanguageLabel(asana, selectedLanguage),
              entry.poses.map(function (pose) {
                return String(pose.poseNumber);
              }).join(', '),
              String(entry.poses.length)
            ];
          })
        },
        sections: [
          {
            title: 'Variant coverage',
            items: sectionItems
          }
        ],
        visuals: model.collectVisualsFromAsanas([asana])
      }
    };
  }

  function executePlan(options) {
    var model = options.model;
    var session = options.session;
    var questionText = compactText(options.questionText || (session && session.questionText));
    var intent = session && session.plan ? session.plan.intent : 'unsupported';
    var templateLabel = session ? session.templateLabel : TEMPLATE_LABELS.unsupported;
    var language = normalizeResultLanguage(options.language || (session && session.language) || (session && session.plan && session.plan.language));

    if (!session || !session.plan) {
      throw new Error('No custom query plan is available yet.');
    }

    if (intent === 'unsupported') {
      throw new Error(session.plan.unsupportedReason || 'The question is outside the supported template set.');
    }

    if (INTENT_TO_QUESTION_ID[intent] && intent !== 'cyp_visual_references') {
      return executeDefaultQuestion(model, INTENT_TO_QUESTION_ID[intent], questionText, session.sparql, templateLabel, language);
    }

    if (intent === 'cyp_visual_references') {
      return buildVisualReferenceAnswer(model, questionText, session.sparql, templateLabel, session.plan, language);
    }

    if (intent === 'pose_guidance') {
      return buildPoseGuidanceAnswer(model, questionText, session.sparql, templateLabel, session.plan, language);
    }

    if (intent === 'variant_pose_counts') {
      return buildVariantPoseCountAnswer(model, questionText, session.sparql, templateLabel, session.plan, language);
    }

    if (intent === 'variant_sequence') {
      return buildVariantSequenceAnswer(model, questionText, session.sparql, templateLabel, session.plan, language);
    }

    if (intent === 'asana_variant_coverage') {
      return buildAsanaVariantCoverageAnswer(model, questionText, session.sparql, templateLabel, session.plan, language);
    }

    throw new Error('Unsupported intent: ' + intent + '.');
  }

  function planQuestion(options) {
    var questionText = compactText(options.questionText);
    var apiKey = compactText(options.apiKey);
    var modelName = compactText(options.modelName) || DEFAULT_MODEL;
    var language = normalizeResultLanguage(options.language);

    if (!questionText) {
      return Promise.reject(new Error('Enter a natural-language question first.'));
    }

    if (!apiKey) {
      return Promise.reject(new Error('Add a Gemini API key before generating a custom query.'));
    }

    return requestStructuredPlan({
      apiKey: apiKey,
      modelName: modelName,
      model: options.model,
      questionText: questionText
    }).then(function (rawPlan) {
      var plan = resolvePlanAgainstModel(options.model, questionText, rawPlan);
      var sparql;

      if (plan.intent === 'unsupported') {
        throw new Error(plan.unsupportedReason || 'Gemini could not map that question to a supported ontology template.');
      }

      plan.language = language;
      sparql = buildSparqlFromPlan(options.model, plan, language);

      return {
        questionText: questionText,
        modelName: modelName,
        language: language,
        plan: plan,
        sparql: sparql,
        templateLabel: TEMPLATE_LABELS[plan.intent] || 'Ontology template'
      };
    });
  }

  function explainExecution(options) {
    var apiKey = compactText(options.apiKey);

    if (!apiKey) {
      return Promise.reject(new Error('Add a Gemini API key before requesting an explanation.'));
    }

    return requestExplanation({
      apiKey: apiKey,
      modelName: compactText(options.modelName) || DEFAULT_MODEL,
      questionText: options.questionText,
      session: options.session,
      execution: options.execution
    });
  }

  global.SNEducationAI = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_MODEL: DEFAULT_MODEL,
    FALLBACK_MODEL: FALLBACK_MODEL,
    TEMPLATE_LABELS: TEMPLATE_LABELS,
    loadApiKey: loadApiKey,
    saveApiKey: saveApiKey,
    clearApiKey: clearApiKey,
    buildSparqlFromPlan: buildSparqlFromPlan,
    planQuestion: planQuestion,
    executePlan: executePlan,
    explainExecution: explainExecution
  };
}(window));
