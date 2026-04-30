(function (global) {
  'use strict';

  var PREFIX_BLOCK = [
    'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>',
    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
    'PREFIX core: <http://example.org/suryanamaskar/core#>',
    'PREFIX base: <http://example.org/suryanamaskar/base-sn#>',
    'PREFIX v1: <http://example.org/suryanamaskar/variant01#>',
    'PREFIX v2: <http://example.org/suryanamaskar/variant02#>',
    'PREFIX v3: <http://example.org/suryanamaskar/variant03#>'
  ].join('\n');

  function withPrefixes(queryBody) {
    return PREFIX_BLOCK + '\n\n' + queryBody.trim();
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

  function unique(items) {
    return items.filter(function (item, index) {
      return items.indexOf(item) === index;
    });
  }

  function lowerFirst(value) {
    var text = String(value || '').trim();
    if (!text) {
      return '';
    }
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  function poseSummary(pose) {
    return 'Pose ' + pose.poseNumber + ' (' + pose.asanaLabel + ')';
  }

  function makeEmptyAnswer(prompt, message) {
    return {
      prompt: prompt,
      narrative: message,
      facts: [],
      sections: [],
      table: null,
      visuals: []
    };
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

  var LANGUAGE_OPTIONS = [
    { code: 'hi', label: 'Hindi', columnLabel: 'Hindi label' },
    { code: 'te', label: 'Telugu', columnLabel: 'Telugu label' }
  ];

  function normalizeResultLanguage(language) {
    var code = String(language || '').trim().toLowerCase();
    return code === 'te' ? 'te' : 'hi';
  }

  function getLanguageOption(language) {
    var code = normalizeResultLanguage(language);
    return LANGUAGE_OPTIONS.find(function (option) {
      return option.code === code;
    }) || LANGUAGE_OPTIONS[0];
  }

  function getLanguageColumnLabel(language) {
    return getLanguageOption(language).columnLabel;
  }

  function getRecordLanguageLabel(record, language) {
    var code = normalizeResultLanguage(language);
    var labels = record && record.labelsByLanguage ? record.labelsByLanguage : {};

    if (!record) {
      return '-';
    }
    return labels[code] || '-';
  }

  function getPoseAsanaLanguageLabel(pose, language) {
    var code = normalizeResultLanguage(language);
    var labels = pose && pose.asanaLabelsByLanguage ? pose.asanaLabelsByLanguage : {};
    return labels[code] || '-';
  }

  function getBreathingPatternLanguageLabel(pose, language) {
    var code = normalizeResultLanguage(language);
    var labels = pose && pose.breathingPatternLabelsByLanguage ? pose.breathingPatternLabelsByLanguage : {};
    return labels[code] || '-';
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

  function resolveQuestion(ref) {
    if (!ref) {
      return null;
    }
    if (typeof ref === 'string') {
      return QUESTIONS.find(function (question) {
        return question.id === ref;
      }) || null;
    }
    return ref;
  }

  function getQuestionSparql(ref, language) {
    var question = resolveQuestion(ref);
    if (!question) {
      return '';
    }
    if (typeof question.buildSparql === 'function') {
      return question.buildSparql({ language: normalizeResultLanguage(language) });
    }
    return typeof question.sparql === 'string' ? question.sparql : '';
  }

  var QUESTIONS = [
    {
      id: 'sn-variants',
      title: 'SN Variants',
      prompt: 'What are the different variants of SN?',
      sparql: withPrefixes(
        'SELECT ?variantLabel (COUNT(DISTINCT ?pose) AS ?poseCount) (COUNT(DISTINCT ?asana) AS ?distinctAsanaCount)\n' +
        'WHERE {\n' +
        '  ?variant rdf:type core:Variant ;\n' +
        '           rdfs:label ?variantLabel .\n' +
        '  OPTIONAL {\n' +
        '    ?pose rdf:type core:Pose ;\n' +
        '          core:belongsToVariant ?variant ;\n' +
        '          core:hasAsana ?asana .\n' +
        '  }\n' +
        '}\n' +
        'GROUP BY ?variantLabel\n' +
        'ORDER BY ?variantLabel'
      ),
      run: function (model) {
        var variants = (model.variants || []).slice().sort(function (left, right) {
          return left.displayLabel.localeCompare(right.displayLabel);
        });

        if (!variants.length) {
          return makeEmptyAnswer(this.prompt, 'No Surya Namaskar variants were found in the loaded ontology.');
        }

        return {
          prompt: this.prompt,
          narrative: 'The ontology currently models ' + variants.length + ' Surya Namaskar variants: ' +
            joinList(variants.map(function (variant) {
              return variant.displayLabel;
            })) + '.',
          facts: [
            { label: 'Variants', value: String(variants.length) }
          ],
          table: {
            columns: ['Variant', 'Pose count', 'Distinct asanas'],
            rows: variants.map(function (variant) {
              var poses = model.getOrderedPosesForVariant(variant);
              var distinctAsanas = unique(poses.map(function (pose) {
                return pose.asanaLabel;
              }).filter(Boolean));

              return [
                variant.displayLabel,
                String(poses.length),
                String(distinctAsanas.length)
              ];
            })
          },
          sections: [
            {
              title: 'Variant list',
              items: variants.map(function (variant) {
                return variant.displayLabel;
              })
            }
          ],
          visuals: []
        };
      }
    },
    {
      id: 'base-sequence',
      title: 'Ordered Pose Sequence',
      prompt: 'What is the complete ordered sequence of poses in the Base Surya Namaskar variant?',
      buildSparql: function (options) {
        return withPrefixes(
        'SELECT ?poseNumber ?pose ?asanaLabel ?asanaLabelSelected ?breathingLabel ?breathingLabelSelected ?laterality ?supportType ?chakra ?mantra ?safetyNote\n' +
        'WHERE {\n' +
        getLanguageValueClause(options && options.language) +
        '  ?pose rdf:type core:Pose ;\n' +
        '        core:belongsToVariant base:BaseSN_SivanandaYogaVedantaCentre_UsedatIITBHU ;\n' +
        '        core:poseNumber ?poseNumber ;\n' +
        '        core:hasAsana ?asana ;\n' +
        '        core:hasLaterality ?laterality ;\n' +
        '        core:hasSupportType ?supportType ;\n' +
        '        core:hasChakra ?chakra ;\n' +
        '        core:hasMantra ?mantra .\n' +
        getAsanaLabelPattern('?asana', '?asanaLabel', '?asanaLabelSelected') +
        '  OPTIONAL {\n' +
        '    ?pose core:hasBreathingPattern ?breathing .\n' +
        getBreathingLabelPattern('?breathing', '?breathingLabel', '?breathingLabelSelected') +
        '  }\n' +
        '  OPTIONAL { ?pose core:hasSafetyNote ?safetyNote . }\n' +
        '}\n' +
        'ORDER BY ?poseNumber'
        );
      },
      run: function (model, options) {
        var baseVariant = model.getBaseVariant();
        var poses = baseVariant ? model.getOrderedPosesForVariant(baseVariant) : [];
        var language = normalizeResultLanguage(options && options.language);
        var distinctAsanas;

        if (!baseVariant || !poses.length) {
          return makeEmptyAnswer(this.prompt, 'The Base SN variant could not be located in the loaded ontology.');
        }

        distinctAsanas = unique(poses.map(function (pose) {
          return pose.asanaLabel;
        }));

        return {
          prompt: this.prompt,
          narrative: baseVariant.displayLabel + ' is modeled as ' + poses.length + ' ordered poses: ' +
            poses.map(poseSummary).join(' -> ') + '.',
          facts: [
            { label: 'Variant', value: baseVariant.displayLabel },
            { label: 'Total poses', value: String(poses.length) },
            { label: 'Distinct asanas', value: String(distinctAsanas.length) }
          ],
          table: {
            columns: ['#', 'Asana', getLanguageColumnLabel(language), 'Breathing', 'Breathing (' + getLanguageOption(language).label + ')', 'Laterality', 'Support', 'Chakra', 'Mantra', 'Safety note'],
            rows: poses.map(function (pose) {
              return [
                String(pose.poseNumber),
                pose.asanaLabel,
                getPoseAsanaLanguageLabel(pose, language),
                pose.breathingPatternLabel || '-',
                getBreathingPatternLanguageLabel(pose, language),
                pose.laterality || '-',
                pose.supportType || '-',
                pose.chakra || '-',
                pose.mantra || '-',
                pose.safetyNote || '-'
              ];
            })
          },
          sections: [],
          visuals: model.collectVisualsFromPoses(poses)
        };
      }
    },
    {
      id: 'base-mantra-chakra',
      title: 'Mantra & Chakra Annotations',
      prompt: 'Which poses in the Base SN variant carry explicit mantra and chakra annotations?',
      buildSparql: function (options) {
        return withPrefixes(
        'SELECT ?poseNumber ?asanaLabel ?asanaLabelSelected ?chakra ?mantra ?breathingLabel ?breathingLabelSelected\n' +
        'WHERE {\n' +
        getLanguageValueClause(options && options.language) +
        '  ?pose rdf:type core:Pose ;\n' +
        '        core:belongsToVariant base:BaseSN_SivanandaYogaVedantaCentre_UsedatIITBHU ;\n' +
        '        core:poseNumber ?poseNumber ;\n' +
        '        core:hasAsana ?asana ;\n' +
        '        core:hasChakra ?chakra ;\n' +
        '        core:hasMantra ?mantra .\n' +
        getAsanaLabelPattern('?asana', '?asanaLabel', '?asanaLabelSelected') +
        '  OPTIONAL {\n' +
        '    ?pose core:hasBreathingPattern ?breathing .\n' +
        getBreathingLabelPattern('?breathing', '?breathingLabel', '?breathingLabelSelected') +
        '  }\n' +
        '}\n' +
        'ORDER BY ?poseNumber'
        );
      },
      run: function (model, options) {
        var baseVariant = model.getBaseVariant();
        var allPoses = baseVariant ? model.getOrderedPosesForVariant(baseVariant) : [];
        var annotated = baseVariant ? model.getPosesWithMantraAndChakra(baseVariant) : [];
        var language = normalizeResultLanguage(options && options.language);
        var coverage;

        if (!baseVariant || !annotated.length) {
          return makeEmptyAnswer(this.prompt, 'No mantra/chakra annotations were found for the Base SN variant.');
        }

        coverage = annotated.length + ' / ' + allPoses.length;

        return {
          prompt: this.prompt,
          narrative: annotated.length === allPoses.length
            ? 'All ' + allPoses.length + ' Base SN poses carry both mantra and chakra annotations.'
            : annotated.length + ' of the ' + allPoses.length + ' Base SN poses carry both mantra and chakra annotations.',
          facts: [
            { label: 'Variant', value: baseVariant.displayLabel },
            { label: 'Coverage', value: coverage },
            { label: 'Unique chakras', value: String(unique(annotated.map(function (pose) { return pose.chakra; })).length) }
          ],
          table: {
            columns: ['#', 'Asana', getLanguageColumnLabel(language), 'Chakra', 'Mantra', 'Breathing', 'Breathing (' + getLanguageOption(language).label + ')'],
            rows: annotated.map(function (pose) {
              return [
                String(pose.poseNumber),
                pose.asanaLabel,
                getPoseAsanaLanguageLabel(pose, language),
                pose.chakra || '-',
                pose.mantra || '-',
                pose.breathingPatternLabel || '-',
                getBreathingPatternLanguageLabel(pose, language)
              ];
            })
          },
          sections: [],
          visuals: model.collectVisualsFromPoses(annotated)
        };
      }
    },
    {
      id: 'base-breathing-safety',
      title: 'Breathing & Safety Notes',
      prompt: 'What are the poses in the Base Surya Namaskar sequence, along with their associated asanas, breathing patterns, and safety notes?',
      buildSparql: function (options) {
        return withPrefixes(
        'SELECT ?poseNumber ?asanaLabel ?asanaLabelSelected ?breathingLabel ?breathingLabelSelected ?safetyNote\n' +
        'WHERE {\n' +
        getLanguageValueClause(options && options.language) +
        '  ?pose rdf:type core:Pose ;\n' +
        '        core:belongsToVariant base:BaseSN_SivanandaYogaVedantaCentre_UsedatIITBHU ;\n' +
        '        core:poseNumber ?poseNumber ;\n' +
        '        core:hasAsana ?asana ;\n' +
        '        core:hasBreathingPattern ?breathing ;\n' +
        '        core:hasSafetyNote ?safetyNote .\n' +
        getAsanaLabelPattern('?asana', '?asanaLabel', '?asanaLabelSelected') +
        getBreathingLabelPattern('?breathing', '?breathingLabel', '?breathingLabelSelected') +
        '}\n' +
        'ORDER BY ?poseNumber'
        );
      },
      run: function (model, options) {
        var baseVariant = model.getBaseVariant();
        var poses = baseVariant ? model.getOrderedPosesForVariant(baseVariant) : [];
        var language = normalizeResultLanguage(options && options.language);
        var breathingCounts = {};

        if (!baseVariant || !poses.length) {
          return makeEmptyAnswer(this.prompt, 'The Base SN variant could not be located in the loaded ontology.');
        }

        poses.forEach(function (pose) {
          var label = pose.breathingPatternLabel || 'Unspecified';
          breathingCounts[label] = (breathingCounts[label] || 0) + 1;
        });

        return {
          prompt: this.prompt,
          narrative: 'Base SN now models breathing and safety annotations for ' + poses.length +
            ' poses. The breathing sequence is: ' + poses.map(function (pose) {
              return 'Pose ' + pose.poseNumber + ' ' + (pose.breathingPatternLabel || 'unspecified');
            }).join(' -> ') + '.',
          facts: [
            { label: 'Variant', value: baseVariant.displayLabel },
            { label: 'Annotated poses', value: String(poses.filter(function (pose) { return pose.breathingPatternLabel || pose.safetyNote; }).length) },
            { label: 'Breathing patterns', value: Object.keys(breathingCounts).map(function (label) {
              return label + ' ' + breathingCounts[label];
            }).join(', ') }
          ],
          table: {
            columns: ['#', 'Asana', getLanguageColumnLabel(language), 'Breathing', 'Breathing (' + getLanguageOption(language).label + ')', 'Safety note'],
            rows: poses.map(function (pose) {
              return [
                String(pose.poseNumber),
                pose.asanaLabel,
                getPoseAsanaLanguageLabel(pose, language),
                pose.breathingPatternLabel || '-',
                getBreathingPatternLanguageLabel(pose, language),
                pose.safetyNote || '-'
              ];
            })
          },
          sections: [],
          visuals: model.collectVisualsFromPoses(poses)
        };
      }
    },
    {
      id: 'base-repeats',
      title: 'Symmetrically Recurring Poses',
      prompt: 'Which poses in the Base Surya Namaskar sequence recur symmetrically in the second half?',
      buildSparql: function (options) {
        return withPrefixes(
        'SELECT ?pose ?repeatPose ?asanaLabel ?asanaLabelSelected\n' +
        'WHERE {\n' +
        getLanguageValueClause(options && options.language) +
        '  ?pose rdf:type core:Pose ;\n' +
        '        core:belongsToVariant base:BaseSN_SivanandaYogaVedantaCentre_UsedatIITBHU ;\n' +
        '        core:hasAsana ?asana ;\n' +
        '        core:repeatsPose ?repeatPose .\n' +
        '  ?repeatPose core:belongsToVariant base:BaseSN_SivanandaYogaVedantaCentre_UsedatIITBHU .\n' +
        getAsanaLabelPattern('?asana', '?asanaLabel', '?asanaLabelSelected') +
        '  FILTER (STR(?pose) < STR(?repeatPose))\n' +
        '}\n' +
        'ORDER BY ?pose ?repeatPose'
        );
      },
      run: function (model, options) {
        var baseVariant = model.getBaseVariant();
        var pairs = baseVariant ? model.getRepeatedPosePairs(baseVariant) : [];
        var language = normalizeResultLanguage(options && options.language);

        if (!baseVariant || !pairs.length) {
          return makeEmptyAnswer(this.prompt, 'No repeated-pose pairs were found for the Base SN variant.');
        }

        return {
          prompt: this.prompt,
          narrative: 'Base SN marks ' + pairs.length + ' repeated-pose pairs on the return path: ' +
            joinList(pairs.map(function (pair) {
              return 'Pose ' + pair.firstPose.poseNumber + ' <-> Pose ' + pair.secondPose.poseNumber +
                ' (' + pair.firstPose.asanaLabel + ')';
            })) + '.',
          facts: [
            { label: 'Variant', value: baseVariant.displayLabel },
            { label: 'Repeated pairs', value: String(pairs.length) }
          ],
          table: {
            columns: ['Earlier pose', 'Later pose', 'Asana', getLanguageColumnLabel(language)],
            rows: pairs.map(function (pair) {
              return [
                'Pose ' + pair.firstPose.poseNumber,
                'Pose ' + pair.secondPose.poseNumber,
                pair.firstPose.asanaLabel,
                getPoseAsanaLanguageLabel(pair.firstPose, language)
              ];
            })
          },
          sections: [],
          visuals: model.collectVisualsFromPoses(pairs.reduce(function (accumulator, pair) {
            return accumulator.concat([pair.firstPose, pair.secondPose]);
          }, []))
        };
      }
    },
    {
      id: 'base-inverses',
      title: 'Laterality Inverse Pairs',
      prompt: 'Which poses in the Base SN sequence exhibit explicit inverse left/right laterality pairings?',
      buildSparql: function (options) {
        return withPrefixes(
        'SELECT ?pose ?inversePose ?asanaLabel ?asanaLabelSelected\n' +
        'WHERE {\n' +
        getLanguageValueClause(options && options.language) +
        '  ?pose rdf:type core:Pose ;\n' +
        '        core:belongsToVariant base:BaseSN_SivanandaYogaVedantaCentre_UsedatIITBHU ;\n' +
        '        core:hasAsana ?asana ;\n' +
        '        core:hasInversePose ?inversePose .\n' +
        '  ?inversePose core:belongsToVariant base:BaseSN_SivanandaYogaVedantaCentre_UsedatIITBHU .\n' +
        getAsanaLabelPattern('?asana', '?asanaLabel', '?asanaLabelSelected') +
        '  FILTER (STR(?pose) < STR(?inversePose))\n' +
        '}\n' +
        'ORDER BY ?pose ?inversePose'
        );
      },
      run: function (model, options) {
        var baseVariant = model.getBaseVariant();
        var pairs = baseVariant ? model.getInversePosePairs(baseVariant) : [];
        var language = normalizeResultLanguage(options && options.language);

        if (!baseVariant || !pairs.length) {
          return makeEmptyAnswer(this.prompt, 'No inverse-pose pairs were found for the Base SN variant.');
        }

        return {
          prompt: this.prompt,
          narrative: 'Base SN has ' + pairs.length + ' inverse pose pair' + (pairs.length === 1 ? '' : 's') + ': ' +
            joinList(pairs.map(function (pair) {
              return 'Pose ' + pair.firstPose.poseNumber + ' (' + pair.firstPose.laterality + ') <-> Pose ' +
                pair.secondPose.poseNumber + ' (' + pair.secondPose.laterality + ') [' + pair.firstPose.asanaLabel + ']';
            })) + '.',
          facts: [
            { label: 'Variant', value: baseVariant.displayLabel },
            { label: 'Inverse pairs', value: String(pairs.length) }
          ],
          table: {
            columns: ['Pose A', 'Pose B', 'Asana', getLanguageColumnLabel(language), 'Laterality'],
            rows: pairs.map(function (pair) {
              return [
                'Pose ' + pair.firstPose.poseNumber,
                'Pose ' + pair.secondPose.poseNumber,
                pair.firstPose.asanaLabel,
                getPoseAsanaLanguageLabel(pair.firstPose, language),
                pair.firstPose.laterality + ' / ' + pair.secondPose.laterality
              ];
            })
          },
          sections: [],
          visuals: model.collectVisualsFromPoses(pairs.reduce(function (accumulator, pair) {
            return accumulator.concat([pair.firstPose, pair.secondPose]);
          }, []))
        };
      }
    },
    {
      id: 'shared-asanas',
      title: 'Cross-Variant Shared Asanas',
      prompt: 'Which asanas appear across two or more Surya Namaskar variants?',
      buildSparql: function (options) {
        return withPrefixes(
        'SELECT ?asana ?asanaLabel ?asanaLabelSelected (COUNT(DISTINCT ?variant) AS ?variantCount)\n' +
        'WHERE {\n' +
        getLanguageValueClause(options && options.language) +
        '  ?pose rdf:type core:Pose ;\n' +
        '        core:hasAsana ?asana ;\n' +
        '        core:belongsToVariant ?variant .\n' +
        getAsanaLabelPattern('?asana', '?asanaLabel', '?asanaLabelSelected') +
        '}\n' +
        'GROUP BY ?asana ?asanaLabel ?asanaLabelSelected\n' +
        'HAVING (COUNT(DISTINCT ?variant) > 1)\n' +
        'ORDER BY DESC(?variantCount) ?asanaLabel'
        );
      },
      run: function (model, options) {
        var entries = model.getSharedAsanas(2);
        var language = normalizeResultLanguage(options && options.language);

        if (!entries.length) {
          return makeEmptyAnswer(this.prompt, 'No shared asanas were found across variants.');
        }

        return {
          prompt: this.prompt,
          narrative: entries.length + ' asanas appear in more than one variant: ' +
            joinList(entries.map(function (entry) {
              return entry.asana.label + ' (' + entry.variants.length + ' variants)';
            })) + '.',
          facts: [
            { label: 'Shared asanas', value: String(entries.length) },
            { label: 'Max coverage', value: String(entries[0].variants.length) + ' variants' }
          ],
          table: {
            columns: ['Asana', getLanguageColumnLabel(language), 'Variant count', 'Variants'],
            rows: entries.map(function (entry) {
              return [
                entry.asana.label,
                getRecordLanguageLabel(entry.asana, language),
                String(entry.variants.length),
                entry.variants.map(function (variant) {
                  return variant.displayLabel;
                }).join(', ')
              ];
            })
          },
          sections: [],
          visuals: model.collectVisualsFromAsanas(entries.map(function (entry) {
            return entry.asana;
          }))
        };
      }
    },
    {
      id: 'same-asana-equivalences',
      title: 'Asana Identity Equivalences',
      prompt: 'Which asana equivalence pairs are explicitly linked via the sameAsanaAs relation?',
      buildSparql: function (options) {
        return withPrefixes(
        'SELECT ?asanaLabel ?asanaLabelSelected ?sameLabel ?sameLabelSelected\n' +
        'WHERE {\n' +
        getLanguageValueClause(options && options.language) +
        '  ?asana rdf:type core:Asana ;\n' +
        '         core:sameAsanaAs ?sameAsana .\n' +
        getAsanaLabelPattern('?asana', '?asanaLabel', '?asanaLabelSelected') +
        getAsanaLabelPattern('?sameAsana', '?sameLabel', '?sameLabelSelected') +
        '  FILTER (STR(?asana) < STR(?sameAsana))\n' +
        '}\n' +
        'ORDER BY ?asanaLabel ?sameLabel'
        );
      },
      run: function (model, options) {
        var pairs = model.getEquivalentAsanaPairs();
        var language = normalizeResultLanguage(options && options.language);

        if (!pairs.length) {
          return makeEmptyAnswer(this.prompt, 'No sameAsanaAs equivalence pairs were found.');
        }

        return {
          prompt: this.prompt,
          narrative: 'The ontology records ' + pairs.length + ' sameAsanaAs equivalence pair' +
            (pairs.length === 1 ? '' : 's') + ': ' +
            joinList(pairs.map(function (pair) {
              return pair.primary.label + ' = ' + pair.secondary.label;
            })) + '.',
          facts: [
            { label: 'Equivalence pairs', value: String(pairs.length) }
          ],
          table: {
            columns: ['Asana A', 'Asana A ' + getLanguageColumnLabel(language), 'Asana B', 'Asana B ' + getLanguageColumnLabel(language)],
            rows: pairs.map(function (pair) {
              return [
                pair.primary.label,
                getRecordLanguageLabel(pair.primary, language),
                pair.secondary.label,
                getRecordLanguageLabel(pair.secondary, language)
              ];
            })
          },
          sections: [],
          visuals: model.collectVisualsFromAsanas(pairs.reduce(function (accumulator, pair) {
            return accumulator.concat([pair.primary, pair.secondary]);
          }, []))
        };
      }
    },
    {
      id: 'cyp-visual-references',
      title: 'CYP Visual References',
      prompt: 'Which asanas are grounded with visual references from the Common Yoga Protocol (CYP)?',
      buildSparql: function (options) {
        return withPrefixes(
        'SELECT ?asanaLabel ?asanaLabelSelected ?cypPage\n' +
        'WHERE {\n' +
        '  ?asana rdf:type core:Asana ;\n' +
        '         core:hasCYPPage ?cypPage .\n' +
        getLanguageValueClause(options && options.language) +
        getAsanaLabelPattern('?asana', '?asanaLabel', '?asanaLabelSelected') +
        '}\n' +
        'ORDER BY ?cypPage ?asanaLabel'
        );
      },
      run: function (model, options) {
        var asanas = model.getAsanasWithVisuals();
        var language = normalizeResultLanguage(options && options.language);
        var distinctPages;

        if (!asanas.length) {
          return makeEmptyAnswer(this.prompt, 'No CYP-linked asanas were found in the ontology.');
        }

        distinctPages = unique(asanas.map(function (asana) {
          return asana.cypPage;
        }));

        return {
          prompt: this.prompt,
          narrative: 'The ontology links ' + asanas.length + ' asanas across ' + distinctPages.length +
            ' distinct CYP page reference' + (distinctPages.length === 1 ? '' : 's') + ': ' +
            joinList(asanas.map(function (asana) {
              return asana.label + ' (page ' + asana.cypPage + ')';
            })) + '.',
          facts: [
            { label: 'Asanas with visuals', value: String(asanas.length) },
            { label: 'Distinct CYP pages', value: distinctPages.join(', ') }
          ],
          table: {
            columns: ['Asana', getLanguageColumnLabel(language), 'CYP page', 'Image'],
            rows: asanas.map(function (asana) {
              return [
                asana.label,
                getRecordLanguageLabel(asana, language),
                asana.cypPage,
                createVisualTableCell(asana)
              ];
            })
          },
          sections: [],
          visuals: model.collectVisualsFromAsanas(asanas)
        };
      }
    }
  ];

  QUESTIONS.forEach(function (question) {
    if (typeof question.buildSparql === 'function') {
      question.sparql = question.buildSparql({ language: 'hi' });
    }
  });

  global.SNEducationData = {
    PREFIX_BLOCK: PREFIX_BLOCK,
    QUESTIONS: QUESTIONS,
    LANGUAGE_OPTIONS: LANGUAGE_OPTIONS,
    DEFAULT_LANGUAGE: 'hi',
    normalizeResultLanguage: normalizeResultLanguage,
    getLanguageOption: getLanguageOption,
    getLanguageColumnLabel: getLanguageColumnLabel,
    getRecordLanguageLabel: getRecordLanguageLabel,
    getPoseAsanaLanguageLabel: getPoseAsanaLanguageLabel,
    getBreathingPatternLanguageLabel: getBreathingPatternLanguageLabel,
    getQuestionSparql: getQuestionSparql
  };
}(window));
