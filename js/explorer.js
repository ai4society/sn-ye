(function (global) {
  'use strict';

  var SUGGESTED_QUESTION_IDS = [
    'sn-variants',
    'base-sequence',
    'base-mantra-chakra',
    'base-repeats',
    'base-inverses',
    'shared-asanas',
    'same-asana-equivalences',
    'cyp-visual-references',
    'base-breathing-safety',
    'base-errors-corrections'
  ];

  // Curated high-separation categorical palette tuned for this ontology's asana set.
  // The order is intentionally varied warm/cool to avoid adjacent labels landing on nearby shades.
  var ASANA_CHIP_ACCENTS = [
    '#BA1C30', '#4277B6', '#5FA641', '#DB6917', '#702C8C', '#E1A11A', '#11A579', '#E73F74',
    '#6F340D', '#3969AC', '#80BA5A', '#0F5D92', '#F97B72', '#008695', '#91218C', '#F2B701',
    '#CF1C90', '#7F3C8D', '#D32B1E', '#A5AA99', '#DF8461', '#4B4B8F', '#E8E948', '#96CDE6',
    '#C0BD7F', '#2B3514', '#E68310', '#D485B2', '#92AE31', '#463397', '#7F7E80', '#B26A00'
  ];
  var VARIANT_CHIP_ACCENTS = ['#2C5AA0', '#C46E2C', '#2E8B57', '#7A3E9D', '#B14E5A', '#0F6E8C'];
  var SPARQL_PREFIX_URIS = {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    owl: 'http://www.w3.org/2002/07/owl#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    core: 'http://example.org/suryanamaskar/core#',
    base: 'http://example.org/suryanamaskar/base-sn#',
    v1: 'http://example.org/suryanamaskar/variant01#',
    v2: 'http://example.org/suryanamaskar/variant02#',
    v3: 'http://example.org/suryanamaskar/variant03#'
  };
  var SPARQL_RESULT_LIMIT = 200;

  var KNOWN_ASANA_CHIP_ACCENTS = {
    'Adho Mukha Svanasana': '#BA1C30',
    'Ardhachakrasana': '#4277B6',
    'Ardhahalasana': '#5FA641',
    'Ardhaustrasana': '#DB6917',
    'Ashtanga Namaskara': '#702C8C',
    'Ashwa Sanchalanasana': '#F4A261',
    'Bhujangasana': '#11A579',
    'Chaturanga Dandasana': '#E73F74',
    'Danda Samarpana': '#6F340D',
    'Hasta Utthanasana': '#3969AC',
    'Makarasana': '#80BA5A',
    'Padahastasana': '#0F5D92',
    'Parvatasana': '#92AE31',
    'Pavanamuktasana': '#008695',
    'Phalakasana': '#91218C',
    'Pranamasana': '#F2B701',
    'Samasthiti': '#CF1C90',
    'Setubandhasana': '#7F3C8D',
    'Shalabhasana': '#D32B1E',
    'Shashankasana': '#A5AA99',
    'Shashtanga Namaskara': '#DF8461',
    'Shavasana': '#4B4B8F',
    'Tadasana': '#E8E948',
    'Urdhwa Mukha Svanasana': '#96CDE6',
    'Ustrasana': '#C0BD7F',
    'Utkatasana': '#2B3514',
    'Uttanamandukasana': '#E68310',
    'Uttanapadasana': '#D485B2',
    'Uttanasana': '#B26A00',
    'Vajrasana': '#463397',
    'Vakrasana': '#7F7E80',
    'Vrksasana': '#F97B72'
  };
  var KNOWN_VARIANT_CHIP_ACCENTS = {
    'Base SN (Sivananda Yoga Vedanta Centre, used at IIT BHU)': '#2C5AA0',
    'Variant 1 Krishnamacharya Vinyasa': '#C46E2C',
    'Variant 2 Bihar School Of Yoga': '#2E8B57',
    'Variant 3 Swami Vivekananda Kendra': '#7A3E9D'
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function clearElement(element) {
    if (!element) {
      return;
    }
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function createElement(tagName, className, textContent) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (typeof textContent === 'string') {
      element.textContent = textContent;
    }
    return element;
  }

  function compactText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeToken(value) {
    return compactText(value).toLowerCase();
  }

  function getSelectedLanguageLabel(state) {
    var option = state && state.data && typeof state.data.getLanguageOption === 'function'
      ? state.data.getLanguageOption(state.selectedLanguage)
      : null;
    return option ? option.label : 'Hindi';
  }

  function normalizeSelectedLanguage(state, language) {
    if (state && state.data && typeof state.data.normalizeResultLanguage === 'function') {
      return state.data.normalizeResultLanguage(language);
    }
    return String(language || '').trim().toLowerCase() === 'te' ? 'te' : 'hi';
  }

  function cloneSparqlPrefixes(extraPrefixes) {
    var prefixes = {};
    Object.keys(SPARQL_PREFIX_URIS).forEach(function (key) {
      prefixes[key] = SPARQL_PREFIX_URIS[key];
    });
    Object.keys(extraPrefixes || {}).forEach(function (key) {
      prefixes[key] = extraPrefixes[key];
    });
    return prefixes;
  }

  function getSparqlPrefixBlock() {
    return Object.keys(SPARQL_PREFIX_URIS).map(function (key) {
      return 'PREFIX ' + key + ': <' + SPARQL_PREFIX_URIS[key] + '>';
    }).join('\n');
  }

  function buildDefaultSparqlQuery(state) {
    return getSparqlPrefixBlock() + '\n\n';
  }

  function stripSparqlComments(queryText) {
    return String(queryText || '').split(/\n/).filter(function (line) {
      return line.trim().charAt(0) !== '#';
    }).join('\n');
  }

  function findMatchingBrace(source, openIndex) {
    var depth = 0;
    var inString = false;
    var inUri = false;
    var escaped = false;
    var index;
    var ch;

    for (index = openIndex; index < source.length; index += 1) {
      ch = source.charAt(index);

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (inUri) {
        if (ch === '>') {
          inUri = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '<') {
        inUri = true;
        continue;
      }
      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          return index;
        }
      }
    }

    return -1;
  }

  function splitOutsideSparql(source, delimiter) {
    var pieces = [];
    var start = 0;
    var inString = false;
    var inUri = false;
    var escaped = false;
    var index;
    var ch;

    for (index = 0; index < source.length; index += 1) {
      ch = source.charAt(index);

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (inUri) {
        if (ch === '>') {
          inUri = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '<') {
        inUri = true;
        continue;
      }
      if (ch === delimiter) {
        pieces.push(source.slice(start, index));
        start = index + 1;
      }
    }

    pieces.push(source.slice(start));
    return pieces;
  }

  function tokenizeSparql(source) {
    var tokens = [];
    var index = 0;
    var ch;
    var start;
    var escaped;

    while (index < source.length) {
      ch = source.charAt(index);

      if (/\s/.test(ch)) {
        index += 1;
        continue;
      }

      if (ch === '<') {
        start = index;
        index += 1;
        while (index < source.length && source.charAt(index) !== '>') {
          index += 1;
        }
        tokens.push(source.slice(start, Math.min(index + 1, source.length)));
        index += 1;
        continue;
      }

      if (ch === '"') {
        start = index;
        index += 1;
        escaped = false;
        while (index < source.length) {
          ch = source.charAt(index);
          if (escaped) {
            escaped = false;
          } else if (ch === '\\') {
            escaped = true;
          } else if (ch === '"') {
            index += 1;
            break;
          }
          index += 1;
        }
        if (source.charAt(index) === '@') {
          index += 1;
          while (index < source.length && /[A-Za-z0-9-]/.test(source.charAt(index))) {
            index += 1;
          }
        } else if (source.slice(index, index + 2) === '^^') {
          index += 2;
          if (source.charAt(index) === '<') {
            while (index < source.length && source.charAt(index) !== '>') {
              index += 1;
            }
            index += 1;
          } else {
            while (index < source.length && /[^\s;,.{}()]/.test(source.charAt(index))) {
              index += 1;
            }
          }
        }
        tokens.push(source.slice(start, index));
        continue;
      }

      if (';,.{}()'.indexOf(ch) !== -1) {
        tokens.push(ch);
        index += 1;
        continue;
      }

      start = index;
      while (index < source.length && /[^\s;,.{}()]/.test(source.charAt(index))) {
        index += 1;
      }
      tokens.push(source.slice(start, index));
    }

    return tokens;
  }

  function decodeSparqlString(value) {
    return String(value || '')
      .replace(/^"/, '')
      .replace(/"(?:@[-A-Za-z0-9]+|\^\^.+)?$/, '')
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }

  function parseSparqlTerm(token, prefixes) {
    var text = String(token || '').trim();
    var prefixedMatch;
    var literalMatch;
    var datatypeToken;
    var datatype;

    if (!text) {
      throw new Error('Empty SPARQL term.');
    }

    if (text.charAt(0) === '?') {
      return {
        type: 'variable',
        name: text.slice(1)
      };
    }

    if (text === 'a') {
      return {
        type: 'uri',
        value: SPARQL_PREFIX_URIS.rdf + 'type'
      };
    }

    if (text.charAt(0) === '<' && text.charAt(text.length - 1) === '>') {
      return {
        type: 'uri',
        value: text.slice(1, -1)
      };
    }

    if (text.charAt(0) === '"') {
      literalMatch = text.match(/^"[\s\S]*?"(?:@([A-Za-z0-9-]+)|\^\^(.+))?$/);
      datatypeToken = literalMatch && literalMatch[2] ? literalMatch[2] : '';
      datatype = '';
      if (datatypeToken) {
        datatype = parseSparqlTerm(datatypeToken, prefixes).value || '';
      }
      return {
        type: 'literal',
        value: decodeSparqlString(text),
        language: literalMatch && literalMatch[1] ? literalMatch[1] : '',
        datatype: datatype
      };
    }

    prefixedMatch = text.match(/^([A-Za-z][A-Za-z0-9_-]*):(.+)$/);
    if (prefixedMatch && prefixes[prefixedMatch[1]]) {
      return {
        type: 'uri',
        value: prefixes[prefixedMatch[1]] + prefixedMatch[2]
      };
    }

    throw new Error('Unsupported SPARQL term: ' + text);
  }

  function parseSparqlValues(valueText, prefixes) {
    return tokenizeSparql(valueText).filter(function (token) {
      return token !== '(' && token !== ')' && token !== ',';
    }).map(function (token) {
      return parseSparqlTerm(token, prefixes);
    });
  }

  function parseSparqlTripleStatements(body, prefixes) {
    var patterns = [];

    splitOutsideSparql(body, '.').forEach(function (statement) {
      var cleanStatement = statement.trim();
      var subjectTerm;

      if (!cleanStatement) {
        return;
      }

      splitOutsideSparql(cleanStatement, ';').forEach(function (segment, segmentIndex) {
        var tokens = tokenizeSparql(segment);
        var predicateTerm;
        var objectText;

        if (!tokens.length) {
          return;
        }

        if (segmentIndex === 0) {
          if (tokens.length < 3) {
            throw new Error('Invalid triple pattern: ' + segment.trim());
          }
          subjectTerm = parseSparqlTerm(tokens[0], prefixes);
          predicateTerm = parseSparqlTerm(tokens[1], prefixes);
          objectText = tokens.slice(2).join(' ');
        } else {
          if (!subjectTerm || tokens.length < 2) {
            throw new Error('Invalid semicolon triple pattern: ' + segment.trim());
          }
          predicateTerm = parseSparqlTerm(tokens[0], prefixes);
          objectText = tokens.slice(1).join(' ');
        }

        splitOutsideSparql(objectText, ',').forEach(function (objectPart) {
          var objectTokens = tokenizeSparql(objectPart);
          if (objectTokens.length !== 1) {
            throw new Error('Use one object term per triple pattern: ' + objectPart.trim());
          }
          patterns.push({
            subject: subjectTerm,
            predicate: predicateTerm,
            object: parseSparqlTerm(objectTokens[0], prefixes)
          });
        });
      });
    });

    return patterns;
  }

  function extractSparqlFilters(body, prefixes) {
    var filters = [];
    var cleanBody = body;

    cleanBody = cleanBody.replace(/FILTER\s*\(\s*LANGMATCHES\s*\(\s*LANG\s*\(\s*(\?[A-Za-z_][A-Za-z0-9_]*)\s*\)\s*,\s*("[^"]*"|\?[A-Za-z_][A-Za-z0-9_]*)\s*\)\s*\)/gi, function (match, variableToken, operandToken) {
      filters.push({
        type: 'langmatches',
        variable: variableToken.slice(1),
        operand: parseSparqlTerm(operandToken, prefixes)
      });
      return '\n';
    });

    cleanBody = cleanBody.replace(/FILTER\s*\(\s*LANG\s*\(\s*(\?[A-Za-z_][A-Za-z0-9_]*)\s*\)\s*=\s*("[^"]*"|\?[A-Za-z_][A-Za-z0-9_]*)\s*\)/gi, function (match, variableToken, operandToken) {
      filters.push({
        type: 'lang',
        variable: variableToken.slice(1),
        operand: parseSparqlTerm(operandToken, prefixes)
      });
      return '\n';
    });

    cleanBody = cleanBody.replace(/FILTER\s*\(\s*(\?[A-Za-z_][A-Za-z0-9_]*)\s*=\s*("[^"]*"(?:@[A-Za-z0-9-]+)?|<[^>]+>|[A-Za-z][A-Za-z0-9_-]*:[^\s)]+|\?[A-Za-z_][A-Za-z0-9_]*)\s*\)/gi, function (match, variableToken, operandToken) {
      filters.push({
        type: 'equals',
        variable: variableToken.slice(1),
        operand: parseSparqlTerm(operandToken, prefixes)
      });
      return '\n';
    });

    return {
      body: cleanBody,
      filters: filters
    };
  }

  function parseSparqlGraphBlock(body, prefixes) {
    var values = [];
    var filterResult = extractSparqlFilters(body, prefixes);
    var cleanBody = filterResult.body;

    cleanBody = cleanBody.replace(/VALUES\s+(\?[A-Za-z_][A-Za-z0-9_]*)\s*\{([^}]*)\}/gi, function (match, variableToken, valueText) {
      values.push({
        variable: variableToken.slice(1),
        terms: parseSparqlValues(valueText, prefixes)
      });
      return '\n';
    });

    return {
      values: values,
      filters: filterResult.filters,
      patterns: parseSparqlTripleStatements(cleanBody, prefixes)
    };
  }

  function parseSparqlSelect(queryText) {
    var source = stripSparqlComments(queryText);
    var prefixes = cloneSparqlPrefixes();
    var prefixRegex = /^\s*PREFIX\s+([A-Za-z][A-Za-z0-9_-]*):\s*<([^>]+)>/gim;
    var match;
    var withoutPrefixes;
    var selectMatch;
    var selectedVariables;
    var whereMatch;
    var openBraceIndex;
    var closeBraceIndex;
    var whereBody;
    var tail;
    var orderMatch;
    var limitMatch;
    var optionals = [];
    var mainBody;

    while ((match = prefixRegex.exec(source))) {
      prefixes[match[1]] = match[2];
    }

    withoutPrefixes = source.replace(prefixRegex, '');
    selectMatch = withoutPrefixes.match(/\bSELECT\s+([\s\S]*?)\bWHERE\b/i);
    if (!selectMatch) {
      throw new Error('Only SELECT ... WHERE queries are supported in this local runner.');
    }

    selectedVariables = compactText(selectMatch[1]) === '*'
      ? ['*']
      : (selectMatch[1].match(/\?[A-Za-z_][A-Za-z0-9_]*/g) || []).map(function (name) {
        return name.slice(1);
      });

    if (!selectedVariables.length) {
      throw new Error('Select at least one variable, for example SELECT ?pose ?asanaLabel.');
    }

    whereMatch = /\bWHERE\s*\{/i.exec(withoutPrefixes);
    if (!whereMatch) {
      throw new Error('Missing WHERE block.');
    }

    openBraceIndex = withoutPrefixes.indexOf('{', whereMatch.index);
    closeBraceIndex = findMatchingBrace(withoutPrefixes, openBraceIndex);
    if (closeBraceIndex === -1) {
      throw new Error('The WHERE block is missing a closing brace.');
    }

    whereBody = withoutPrefixes.slice(openBraceIndex + 1, closeBraceIndex);
    tail = withoutPrefixes.slice(closeBraceIndex + 1);
    orderMatch = tail.match(/\bORDER\s+BY\s+((?:\?[A-Za-z_][A-Za-z0-9_]*\s*)+)/i);
    limitMatch = tail.match(/\bLIMIT\s+(\d+)/i);

    mainBody = whereBody.replace(/OPTIONAL\s*\{([\s\S]*?)\}/gi, function (optionalMatch, optionalBody) {
      optionals.push(parseSparqlGraphBlock(optionalBody, prefixes));
      return '\n';
    });

    return {
      prefixes: prefixes,
      select: selectedVariables,
      main: parseSparqlGraphBlock(mainBody, prefixes),
      optionals: optionals,
      orderBy: orderMatch
        ? (orderMatch[1].match(/\?[A-Za-z_][A-Za-z0-9_]*/g) || []).map(function (name) {
          return name.slice(1);
        })
        : [],
      limit: limitMatch ? Math.max(0, Number(limitMatch[1])) : SPARQL_RESULT_LIMIT
    };
  }

  function tripleTermForPosition(triple, position) {
    if (position === 'subject') {
      return {
        termType: 'NamedNode',
        value: triple.subject
      };
    }
    if (position === 'predicate') {
      return {
        termType: 'NamedNode',
        value: triple.predicate
      };
    }
    return triple.object;
  }

  function termMatchesFixed(patternTerm, actualTerm) {
    if (!patternTerm || !actualTerm) {
      return false;
    }
    if (patternTerm.type === 'uri') {
      return actualTerm.termType === 'NamedNode' && actualTerm.value === patternTerm.value;
    }
    if (patternTerm.type === 'literal') {
      return actualTerm.termType === 'Literal' &&
        actualTerm.value === patternTerm.value &&
        (!patternTerm.language || normalizeToken(actualTerm.language) === normalizeToken(patternTerm.language)) &&
        (!patternTerm.datatype || actualTerm.datatype === patternTerm.datatype);
    }
    return false;
  }

  function bindPatternTerm(binding, patternTerm, actualTerm) {
    var existing;

    if (patternTerm.type !== 'variable') {
      return termMatchesFixed(patternTerm, actualTerm) ? binding : null;
    }

    existing = binding[patternTerm.name];
    if (existing) {
      return termsEqual(existing, actualTerm) ? binding : null;
    }

    binding = Object.assign({}, binding);
    binding[patternTerm.name] = actualTerm;
    return binding;
  }

  function termsEqual(left, right) {
    return Boolean(left && right) &&
      left.termType === right.termType &&
      left.value === right.value &&
      (left.language || '') === (right.language || '') &&
      (left.datatype || '') === (right.datatype || '');
  }

  function resolveFilterOperand(operand, binding) {
    if (!operand) {
      return null;
    }
    if (operand.type === 'variable') {
      return binding[operand.name] || null;
    }
    if (operand.type === 'uri') {
      return {
        termType: 'NamedNode',
        value: operand.value
      };
    }
    return {
      termType: 'Literal',
      value: operand.value,
      language: operand.language || '',
      datatype: operand.datatype || ''
    };
  }

  function getTermLexicalValue(term) {
    return term ? String(term.value || '') : '';
  }

  function evaluateSparqlFilter(filter, binding) {
    var leftTerm = binding[filter.variable];
    var rightTerm = resolveFilterOperand(filter.operand, binding);
    var language;
    var expected;

    if (!leftTerm || !rightTerm) {
      return false;
    }

    if (filter.type === 'lang' || filter.type === 'langmatches') {
      language = normalizeToken(leftTerm.language);
      expected = normalizeToken(getTermLexicalValue(rightTerm));
      if (filter.type === 'langmatches' && expected === '*') {
        return Boolean(language);
      }
      return language === expected;
    }

    if (filter.type === 'equals') {
      if (leftTerm.termType === 'NamedNode' || rightTerm.termType === 'NamedNode') {
        return leftTerm.termType === rightTerm.termType && leftTerm.value === rightTerm.value;
      }
      return leftTerm.value === rightTerm.value;
    }

    return true;
  }

  function applySparqlValues(bindings, values) {
    var output = bindings.slice();

    values.forEach(function (valueSet) {
      var next = [];
      output.forEach(function (binding) {
        valueSet.terms.forEach(function (termPattern) {
          var term = resolveFilterOperand(termPattern, binding);
          var updated = Object.assign({}, binding);
          updated[valueSet.variable] = term;
          next.push(updated);
        });
      });
      output = next;
    });

    return output;
  }

  function matchSparqlPatterns(bindings, patterns, triples) {
    var output = bindings.slice();

    patterns.forEach(function (pattern) {
      var next = [];
      output.forEach(function (binding) {
        triples.forEach(function (triple) {
          var candidate = Object.assign({}, binding);
          candidate = bindPatternTerm(candidate, pattern.subject, tripleTermForPosition(triple, 'subject'));
          if (!candidate) {
            return;
          }
          candidate = bindPatternTerm(candidate, pattern.predicate, tripleTermForPosition(triple, 'predicate'));
          if (!candidate) {
            return;
          }
          candidate = bindPatternTerm(candidate, pattern.object, tripleTermForPosition(triple, 'object'));
          if (!candidate) {
            return;
          }
          next.push(candidate);
        });
      });
      output = next;
    });

    return output;
  }

  function applySparqlGraphBlock(bindings, block, triples) {
    var output = applySparqlValues(bindings, block.values || []);
    output = matchSparqlPatterns(output, block.patterns || [], triples);
    if (block.filters && block.filters.length) {
      output = output.filter(function (binding) {
        return block.filters.every(function (filter) {
          return evaluateSparqlFilter(filter, binding);
        });
      });
    }
    return output;
  }

  function applySparqlOptionalBlock(bindings, block, triples) {
    var output = [];

    bindings.forEach(function (binding) {
      var matches = applySparqlGraphBlock([binding], block, triples);
      if (matches.length) {
        output = output.concat(matches);
      } else {
        output.push(binding);
      }
    });

    return output;
  }

  function compactSparqlUri(uri, prefixes) {
    var orderedPrefixes = Object.keys(prefixes || {}).sort(function (left, right) {
      return prefixes[right].length - prefixes[left].length;
    });
    var match = orderedPrefixes.find(function (prefix) {
      return String(uri || '').indexOf(prefixes[prefix]) === 0;
    });

    if (match) {
      return match + ':' + String(uri).slice(prefixes[match].length);
    }

    return global.SNOntologyGraph && typeof global.SNOntologyGraph.prettifyIdentifier === 'function'
      ? global.SNOntologyGraph.prettifyIdentifier(uri)
      : String(uri || '');
  }

  function formatSparqlTerm(term, prefixes) {
    if (!term) {
      return '';
    }
    if (term.termType === 'NamedNode') {
      return compactSparqlUri(term.value, prefixes);
    }
    if (term.language) {
      return term.value + ' @' + term.language;
    }
    return term.value;
  }

  function getSparqlSortValue(term) {
    var value = term ? String(term.value || '') : '';
    var numeric = Number(value);
    return value !== '' && !Number.isNaN(numeric) ? numeric : value.toLowerCase();
  }

  function executeSparqlSelect(model, queryText) {
    var parsed = parseSparqlSelect(queryText);
    var triples = model && model.triples ? model.triples : [];
    var bindings = [{}];
    var selectedVariables;
    var rows;
    var effectiveLimit = parsed.limit || SPARQL_RESULT_LIMIT;

    bindings = applySparqlGraphBlock(bindings, parsed.main, triples);
    parsed.optionals.forEach(function (optionalBlock) {
      bindings = applySparqlOptionalBlock(bindings, optionalBlock, triples);
    });

    if (parsed.orderBy.length) {
      bindings.sort(function (left, right) {
        var index;
        var leftValue;
        var rightValue;
        for (index = 0; index < parsed.orderBy.length; index += 1) {
          leftValue = getSparqlSortValue(left[parsed.orderBy[index]]);
          rightValue = getSparqlSortValue(right[parsed.orderBy[index]]);
          if (leftValue < rightValue) return -1;
          if (leftValue > rightValue) return 1;
        }
        return 0;
      });
    }

    if (parsed.select.length === 1 && parsed.select[0] === '*') {
      selectedVariables = [];
      bindings.forEach(function (binding) {
        Object.keys(binding).forEach(function (variable) {
          if (selectedVariables.indexOf(variable) === -1) {
            selectedVariables.push(variable);
          }
        });
      });
    } else {
      selectedVariables = parsed.select;
    }

    rows = bindings.slice(0, effectiveLimit).map(function (binding) {
      return selectedVariables.map(function (variable) {
        return formatSparqlTerm(binding[variable], parsed.prefixes);
      });
    });

    return {
      variables: selectedVariables,
      rows: rows,
      totalRows: bindings.length,
      returnedRows: rows.length,
      capped: bindings.length > effectiveLimit,
      limit: effectiveLimit
    };
  }

  function hashString(value) {
    var text = String(value || '');
    var hash = 0;
    var index;

    for (index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }

    return Math.abs(hash);
  }

  function hexToHsl(value) {
    var hex = String(value || '').replace('#', '');
    var red;
    var green;
    var blue;
    var max;
    var min;
    var delta;
    var hue = 0;
    var saturation = 0;
    var lightness;

    if (hex.length === 3) {
      hex = hex.replace(/(.)/g, '$1$1');
    }

    red = parseInt(hex.slice(0, 2), 16) / 255;
    green = parseInt(hex.slice(2, 4), 16) / 255;
    blue = parseInt(hex.slice(4, 6), 16) / 255;

    max = Math.max(red, green, blue);
    min = Math.min(red, green, blue);
    delta = max - min;
    lightness = (max + min) / 2;

    if (delta !== 0) {
      saturation = delta / (1 - Math.abs((2 * lightness) - 1));

      switch (max) {
      case red:
        hue = 60 * (((green - blue) / delta) % 6);
        break;
      case green:
        hue = 60 * (((blue - red) / delta) + 2);
        break;
      default:
        hue = 60 * (((red - green) / delta) + 4);
        break;
      }
    }

    if (hue < 0) {
      hue += 360;
    }

    return {
      h: hue,
      s: saturation * 100,
      l: lightness * 100
    };
  }

  function buildAsanaChipTheme(accentHex) {
    var hsl = hexToHsl(accentHex);
    var hue = hsl.h;
    var saturation = Math.max(58, Math.min(82, hsl.s || 68));

    return {
      accent: 'hsl(' + hue + ', ' + saturation + '%, 38%)',
      background: 'hsl(' + hue + ', ' + Math.max(42, saturation - 18) + '%, 95%)',
      border: 'hsl(' + hue + ', ' + Math.max(34, saturation - 28) + '%, 74%)',
      text: 'hsl(' + hue + ', ' + saturation + '%, 24%)'
    };
  }

  function buildVariantChipTheme(accentHex) {
    var hsl = hexToHsl(accentHex);
    var hue = hsl.h;
    var saturation = Math.max(40, Math.min(68, hsl.s || 56));

    return {
      accent: 'hsl(' + hue + ', ' + saturation + '%, 40%)',
      background: 'hsl(' + hue + ', ' + Math.max(24, saturation - 20) + '%, 97%)',
      border: 'hsl(' + hue + ', ' + Math.max(20, saturation - 24) + '%, 82%)',
      text: 'hsl(' + hue + ', ' + Math.max(44, saturation + 4) + '%, 27%)'
    };
  }

  function initializeAsanaThemeMap(state) {
    var labels;

    if (!state || state.asanaThemeMapInitialized || !state.model || !state.model.asanas) {
      return;
    }

    state.asanaThemeMap = state.asanaThemeMap || {};
    labels = state.model.asanas
      .map(function (asana) {
        return compactText(asana && asana.label);
      })
      .filter(Boolean)
      .sort(function (left, right) {
        return left.localeCompare(right);
      })
      .filter(function (label, index, items) {
        return index === 0 || label !== items[index - 1];
      });

    labels.forEach(function (label, index) {
      var accent = KNOWN_ASANA_CHIP_ACCENTS[label] ||
        ASANA_CHIP_ACCENTS[index % ASANA_CHIP_ACCENTS.length];
      state.asanaThemeMap[normalizeToken(label)] = accent;
    });

    state.model.asanas.forEach(function (asana, index) {
      var baseAccent = state.asanaThemeMap[normalizeToken(asana.label)] ||
        KNOWN_ASANA_CHIP_ACCENTS[asana.label] ||
        ASANA_CHIP_ACCENTS[index % ASANA_CHIP_ACCENTS.length];
      Object.keys(asana.labelsByLanguage || {}).forEach(function (language) {
        var label = compactText(asana.labelsByLanguage[language]);
        if (label) {
          state.asanaThemeMap[normalizeToken(label)] = baseAccent;
        }
      });
    });

    state.asanaThemeMapInitialized = true;
  }

  function initializeVariantThemeMap(state) {
    var labels;

    if (!state || state.variantThemeMapInitialized || !state.model || !state.model.variants) {
      return;
    }

    state.variantThemeMap = state.variantThemeMap || {};
    labels = state.model.variants
      .map(function (variant) {
        return compactText(variant && variant.displayLabel);
      })
      .filter(Boolean)
      .sort(function (left, right) {
        return left.localeCompare(right);
      })
      .filter(function (label, index, items) {
        return index === 0 || label !== items[index - 1];
      });

    labels.forEach(function (label, index) {
      state.variantThemeMap[normalizeToken(label)] = KNOWN_VARIANT_CHIP_ACCENTS[label] ||
        VARIANT_CHIP_ACCENTS[index % VARIANT_CHIP_ACCENTS.length];
    });

    state.variantThemeMapInitialized = true;
  }

  function isAsanaColumn(columnLabel) {
    var key = normalizeToken(columnLabel);
    return /\basana\b/.test(key) ||
      /\b(hindi|telugu) label\b/.test(key) ||
      key === 'first pose' ||
      key === 'last pose';
  }

  function isVariantColumn(columnLabel) {
    return /\bvariant\b/.test(normalizeToken(columnLabel));
  }

  function getAsanaChipTheme(state, label) {
    var key = normalizeToken(label);
    var accentHex;

    if (!key || key === '-') {
      return null;
    }

    initializeAsanaThemeMap(state);
    state.asanaThemeMap = state.asanaThemeMap || {};

    if (typeof state.asanaThemeMap[key] !== 'string') {
      state.asanaThemeMap[key] = ASANA_CHIP_ACCENTS[hashString(key) % ASANA_CHIP_ACCENTS.length];
    }

    accentHex = state.asanaThemeMap[key];
    return buildAsanaChipTheme(accentHex);
  }

  function createAsanaChip(state, label) {
    var text = compactText(label);
    var theme = getAsanaChipTheme(state, text);
    var chip;
    var marker;
    var chipLabel;

    chip = createElement('span', 'education-asana-chip');
    marker = createElement('span', 'education-asana-chip-marker');
    chipLabel = createElement('span', 'education-asana-chip-label', text);

    chip.title = text;

    if (theme) {
      chip.style.setProperty('--education-asana-accent', theme.accent);
      chip.style.setProperty('--education-asana-bg', theme.background);
      chip.style.setProperty('--education-asana-border', theme.border);
      chip.style.setProperty('--education-asana-text', theme.text);
    }

    marker.setAttribute('aria-hidden', 'true');
    chip.appendChild(marker);
    chip.appendChild(chipLabel);

    return chip;
  }

  function getVariantChipTheme(state, label) {
    var key = normalizeToken(label);
    var accentHex;

    if (!key || key === '-') {
      return null;
    }

    initializeVariantThemeMap(state);
    state.variantThemeMap = state.variantThemeMap || {};

    if (typeof state.variantThemeMap[key] !== 'string') {
      state.variantThemeMap[key] = VARIANT_CHIP_ACCENTS[hashString(key) % VARIANT_CHIP_ACCENTS.length];
    }

    accentHex = state.variantThemeMap[key];
    return buildVariantChipTheme(accentHex);
  }

  function createVariantChip(state, label) {
    var text = compactText(label);
    var theme = getVariantChipTheme(state, text);
    var chip = createElement('span', 'education-variant-chip');
    var rail = createElement('span', 'education-variant-chip-rail');
    var chipLabel = createElement('span', 'education-variant-chip-label', text);

    chip.title = text;

    if (theme) {
      chip.style.setProperty('--education-variant-accent', theme.accent);
      chip.style.setProperty('--education-variant-bg', theme.background);
      chip.style.setProperty('--education-variant-border', theme.border);
      chip.style.setProperty('--education-variant-text', theme.text);
    }

    rail.setAttribute('aria-hidden', 'true');
    chip.appendChild(rail);
    chip.appendChild(chipLabel);

    return chip;
  }

  function padIndex(value) {
    var number = Number(value) || 0;
    return number < 10 ? '0' + number : String(number);
  }

  function questionMeta(questionId) {
    if (questionId.indexOf('visual') !== -1) {
      return 'Visual Grounding';
    }
    if (questionId.indexOf('guidance') !== -1) {
      return 'Pose Guidance';
    }
    if (questionId.indexOf('error') !== -1 || questionId.indexOf('correction') !== -1) {
      return 'Pose Guidance';
    }
    if (questionId.indexOf('shared') !== -1 || questionId.indexOf('same-') !== -1 || questionId.indexOf('variant') !== -1) {
      return 'Cross-Variant';
    }
    if (questionId.indexOf('mantra') !== -1 || questionId.indexOf('breathing') !== -1) {
      return 'Annotations';
    }
    if (questionId.indexOf('repeat') !== -1 || questionId.indexOf('inverse') !== -1 || questionId.indexOf('sequence') !== -1) {
      return 'Sequence Analysis';
    }
    return 'Ontology Query';
  }

  function getSuggestedQuestions(questions) {
    var byQuestionId = questions.reduce(function (accumulator, question) {
      accumulator[question.id] = question;
      return accumulator;
    }, {});

    return SUGGESTED_QUESTION_IDS.map(function (questionId) {
      return byQuestionId[questionId];
    }).filter(Boolean);
  }

  function getInitialQuestionId(questions) {
    var requestedId = compactText(window.location.hash || '').replace(/^#/, '');
    var match;

    if (!requestedId) {
      return questions[0] ? questions[0].id : '';
    }

    match = questions.find(function (question) {
      return question.id === requestedId;
    });

    return match ? match.id : (questions[0] ? questions[0].id : '');
  }

  function setStatus(state, message) {
    if (state.status) {
      state.status.textContent = message || '';
    }
  }

  function setAIStatus(state, message) {
    if (state.aiStatus) {
      state.aiStatus.textContent = message || '';
    }
  }

  function setError(state, message) {
    if (state.error) {
      state.error.hidden = !message;
      state.error.textContent = message || '';
    }
    if (state.nlError) {
      state.nlError.hidden = !message;
      state.nlError.textContent = message || '';
    }
  }

  function setButtonDisabled(button, disabled) {
    if (!button) {
      return;
    }
    button.disabled = Boolean(disabled);
    button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }

  function setAnswerView(state, view) {
    var isQueryView = view === 'query';

    state.currentAnswerView = isQueryView ? 'query' : 'answer';

    if (state.answerPanel) {
      state.answerPanel.setAttribute('data-view', state.currentAnswerView);
    }

    if (state.answerContent) {
      state.answerContent.hidden = isQueryView;
    }

    if (state.queryView) {
      state.queryView.hidden = !isQueryView;
    }

    if (state.answerViewToggle) {
      state.answerViewToggle.setAttribute('aria-pressed', isQueryView ? 'true' : 'false');
      state.answerViewToggle.textContent = isQueryView ? 'Show Answer' : 'Show SPARQL';
    }
  }

  function clearStructuredAnswer(state) {
    clearElement(state.facts);
    clearElement(state.sections);
    if (state.sections) {
      state.sections.hidden = true;
    }
  }

  function clearAnswerSurface(state, options) {
    var config = options || {};

    if (state.answerTitle) {
      state.answerTitle.textContent = config.title || 'Answer Surface';
    }

    if (state.answerText) {
      state.answerText.textContent = config.narrative || '';
    }

    if (state.activeQuestionId) {
      state.activeQuestionId.textContent = config.badgeLabel || '';
    }

    if (state.sparql) {
      state.sparql.textContent = config.sparql || '';
    }

    if (state.queryNote) {
      state.queryNote.textContent = config.queryNote || 'Generated query';
    }

    clearStructuredAnswer(state);
    setError(state, '');

    if (config.clearVisuals !== false) {
      renderVisuals(state, []);
      if (state.visualNote && config.visualNote) {
        state.visualNote.textContent = config.visualNote;
      }
    }
  }

  function setWorkspaceMode(state, mode) {
    var activeMode = mode === 'custom' || mode === 'sparql' ? mode : 'predefined';
    var previousMode = state.workspaceMode;

    state.workspaceMode = activeMode;

    if (state.layout) {
      state.layout.setAttribute('data-mode', activeMode);
    }

    if (state.customModeButton) {
      state.customModeButton.setAttribute('aria-pressed', activeMode === 'custom' ? 'true' : 'false');
    }

    if (state.predefinedModeButton) {
      state.predefinedModeButton.setAttribute('aria-pressed', activeMode === 'predefined' ? 'true' : 'false');
    }

    if (state.sparqlModeButton) {
      state.sparqlModeButton.setAttribute('aria-pressed', activeMode === 'sparql' ? 'true' : 'false');
    }

    if (state.nlInterface) {
      state.nlInterface.style.display = activeMode === 'custom' ? 'grid' : 'none';
    }

    if (state.predefinedInterface) {
      state.predefinedInterface.style.display = activeMode === 'predefined' ? 'grid' : 'none';
    }

    if (state.sparqlInterface) {
      state.sparqlInterface.style.display = activeMode === 'sparql' ? 'grid' : 'none';
    }

    if (previousMode === activeMode) {
      return;
    }

    if (activeMode === 'custom') {
      if (state.aiExecution) {
        renderCustomExecution(state, state.aiExecution, Boolean(state.aiExplained));
      } else {
        clearAnswerSurface(state, {
          title: 'Natural Language Output',
          badgeLabel: 'AI',
          sparql: state.aiSession ? state.aiSession.sparql : '',
          queryNote: state.aiSession ? state.aiSession.templateLabel : 'Generated query',
          visualNote: 'Linked CYP visuals for the custom query will appear here when the query returns mapped pages.'
        });
        setAnswerView(state, 'answer');
      }
      return;
    }

    if (activeMode === 'sparql') {
      if (state.sparqlEditor && !compactText(state.sparqlEditor.value)) {
        state.sparqlEditor.value = buildDefaultSparqlQuery(state);
      }
      return;
    }

    if (state.model && state.lastPredefinedQuestionId) {
      renderQuestion(state, state.lastPredefinedQuestionId);
    }
  }

  function renderFacts(state, facts) {
    clearElement(state.facts);

    if (!facts || !facts.length) {
      return;
    }

    facts.forEach(function (fact) {
      var card = createElement('div', 'education-fact-card');
      var label = createElement('span', '', fact.label);
      var value = createElement('strong', '', fact.value);
      card.appendChild(label);
      card.appendChild(value);
      state.facts.appendChild(card);
    });
  }

  function isVisualCellData(value) {
    return Boolean(
      value &&
      typeof value === 'object' &&
      value.kind === 'cyp-visual' &&
      value.src
    );
  }

  function renderVisualTableCell(state, visualData) {
    var cell = createElement('td', 'education-table-cell education-table-cell--visual');
    var button = createElement('button', 'education-table-visual-button');
    var image = createElement('img', 'education-table-visual-image');
    var label = createElement('span', 'education-table-visual-label', 'Expand image');
    var pageText = visualData.page ? 'CYP page ' + visualData.page : 'Linked CYP image';

    button.type = 'button';
    button.title = 'Expand ' + (visualData.asanaLabel || 'CYP visual');
    button.setAttribute(
      'aria-label',
      'Expand ' + (visualData.asanaLabel || 'asana') + ' visual reference' +
      (visualData.page ? ' from CYP page ' + visualData.page : '')
    );

    image.src = visualData.src;
    image.alt = visualData.alt || ((visualData.asanaLabel || 'Asana') + ' visual reference');
    image.loading = 'lazy';

    button.appendChild(image);
    button.appendChild(label);
    button.addEventListener('click', function () {
      openLightbox(state, {
        src: visualData.src,
        alt: visualData.alt,
        asanaLabel: visualData.asanaLabel || 'CYP visual',
        caption: visualData.caption || pageText,
        page: visualData.page || ''
      });
    });

    cell.appendChild(button);
    return cell;
  }

  function renderTableCell(state, columnLabel, cellValue) {
    var cell = createElement('td');
    var text;

    if (isVisualCellData(cellValue)) {
      return renderVisualTableCell(state, cellValue);
    }

    text = String(cellValue);

    if (isVariantColumn(columnLabel) && compactText(cellValue) && compactText(cellValue) !== '-') {
      cell.className = 'education-table-cell education-table-cell--variant';
      cell.appendChild(createVariantChip(state, text));
      return cell;
    }

    if (isAsanaColumn(columnLabel) && compactText(cellValue) && compactText(cellValue) !== '-') {
      cell.className = 'education-table-cell education-table-cell--asana';
      cell.appendChild(createAsanaChip(state, text));
      return cell;
    }

    cell.textContent = text;
    return cell;
  }

  function renderTable(state, container, table) {
    var wrapper;
    var tableElement;
    var thead;
    var headerRow;
    var tbody;

    if (!table || !table.columns || !table.rows) {
      return;
    }

    wrapper = createElement('div', 'education-detail-card education-table-wrap');
    tableElement = createElement('table');
    thead = createElement('thead');
    headerRow = createElement('tr');
    tbody = createElement('tbody');

    table.columns.forEach(function (column) {
      headerRow.appendChild(createElement('th', '', column));
    });

    table.rows.forEach(function (row) {
      var bodyRow = createElement('tr');
      row.forEach(function (cell, index) {
        bodyRow.appendChild(renderTableCell(state, table.columns[index] || '', cell));
      });
      tbody.appendChild(bodyRow);
    });

    thead.appendChild(headerRow);
    tableElement.appendChild(thead);
    tableElement.appendChild(tbody);
    wrapper.appendChild(tableElement);
    container.appendChild(wrapper);
  }

  function renderSections(state, answer) {
    if (!state.sections) {
      return;
    }

    clearElement(state.sections);

    if (answer.table) {
      renderTable(state, state.sections, answer.table);
    }
    state.sections.hidden = !state.sections.children.length;
  }

  function setSparqlError(state, message) {
    if (!state.sparqlError) {
      return;
    }
    state.sparqlError.hidden = !message;
    state.sparqlError.textContent = message || '';
  }

  function clearSparqlResults(state) {
    clearElement(state.sparqlFacts);
    clearElement(state.sparqlSections);
    if (state.sparqlSections) {
      state.sparqlSections.hidden = true;
    }
    if (state.sparqlEmpty) {
      state.sparqlEmpty.hidden = false;
      state.sparqlEmpty.textContent = 'Results from the direct SPARQL editor will appear here.';
    }
    if (state.sparqlResultsTitle) {
      state.sparqlResultsTitle.textContent = 'Run a query';
    }
    if (state.sparqlResultNote) {
      state.sparqlResultNote.textContent = 'Local OWL evaluation';
    }
    setSparqlError(state, '');
  }

  function renderSparqlResult(state, result) {
    var previousFacts = state.facts;
    var previousSections = state.sections;
    var table;

    if (!result) {
      clearSparqlResults(state);
      return;
    }

    if (state.sparqlResultsTitle) {
      state.sparqlResultsTitle.textContent = result.returnedRows + ' result' +
        (result.returnedRows === 1 ? '' : 's');
    }

    if (state.sparqlResultNote) {
      state.sparqlResultNote.textContent = result.capped
        ? 'Showing first ' + result.returnedRows + ' of ' + result.totalRows + ' rows'
        : 'Returned ' + result.returnedRows + ' row' + (result.returnedRows === 1 ? '' : 's');
    }

    if (state.sparqlEmpty) {
      state.sparqlEmpty.hidden = result.returnedRows > 0;
      state.sparqlEmpty.textContent = result.returnedRows
        ? ''
        : 'The query ran successfully, but no matching triples were found.';
    }

    state.facts = state.sparqlFacts;
    renderFacts(state, [
      { label: 'Rows', value: String(result.returnedRows) },
      { label: 'Variables', value: String(result.variables.length) },
      { label: 'Limit', value: String(result.limit) }
    ]);
    state.facts = previousFacts;

    clearElement(state.sparqlSections);
    if (result.returnedRows > 0) {
      table = {
        columns: result.variables.map(function (variable) {
          return '?' + variable;
        }),
        rows: result.rows
      };
      state.sections = state.sparqlSections;
      renderSections(state, { table: table });
      state.sections = previousSections;
    } else if (state.sparqlSections) {
      state.sparqlSections.hidden = true;
    }

    setSparqlError(state, '');
  }

  function closeLightbox(state) {
    if (!state.lightbox) {
      return;
    }

    state.lightbox.hidden = true;
    state.lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function openLightbox(state, visual) {
    if (!state.lightbox || !state.lightboxImage || !state.lightboxCaption) {
      return;
    }

    state.lightboxImage.src = visual.src;
    state.lightboxImage.alt = visual.alt || visual.asanaLabel || 'Expanded CYP visual';
    state.lightboxCaption.textContent = visual.asanaLabel + ' - ' + visual.caption;
    state.lightbox.hidden = false;
    state.lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function renderVisuals(state, visuals) {
    clearElement(state.visuals);

    if (!visuals || !visuals.length) {
      state.visuals.appendChild(
        createElement(
          'div',
          'education-visual-empty',
          'No linked CYP page is available for the selected answer yet. Add more hasCYPPage annotations to expand this panel.'
        )
      );
      if (state.visualNote) {
        state.visualNote.textContent = 'No linked CYP page is currently available for this answer in the ontology.';
      }
      return;
    }

    if (state.visualNote) {
      state.visualNote.textContent = 'Showing ' + visuals.length + ' linked CYP page visual' +
        (visuals.length === 1 ? '' : 's') + ' for the selected answer.';
    }

    visuals.forEach(function (visual) {
      var card = createElement('article', 'education-visual-card');
      var button = createElement('button', 'education-visual-button');
      var image = createElement('img', 'visual-reference-thumbnail');
      var meta = createElement('div', 'education-visual-meta');
      var title = createElement('strong', '', visual.asanaLabel);
      var caption = createElement('p', '', visual.caption);
      var page = createElement('span', '', 'Page ' + visual.page);

      button.type = 'button';
      image.src = visual.src;
      image.alt = visual.alt;
      image.loading = 'lazy';

      button.appendChild(image);
      button.addEventListener('click', function () {
        openLightbox(state, visual);
      });

      meta.appendChild(title);
      meta.appendChild(caption);
      meta.appendChild(page);

      card.appendChild(button);
      card.appendChild(meta);
      state.visuals.appendChild(card);
    });
  }

  function renderAnswer(state, descriptor, answer) {
    var queryNote = descriptor.queryNote || 'Query template';

    if (state.answerTitle) {
      state.answerTitle.textContent = descriptor.prompt || 'Ontology answer';
    }

    if (state.answerText) {
      state.answerText.textContent = answer.narrative || '';
    }

    if (state.activeQuestionId) {
      state.activeQuestionId.textContent = descriptor.badgeLabel || '';
    }

    if (state.sparql) {
      state.sparql.textContent = descriptor.sparql || '';
    }

    if (state.queryNote) {
      state.queryNote.textContent = queryNote;
    }

    renderFacts(state, answer.facts || []);
    renderSections(state, answer);
    renderVisuals(state, answer.visuals || []);
    setError(state, '');
    setStatus(state, state.model ? 'Ontology ready' : 'Loading ontology');
  }

  function hideCustomExplanation(state) {
    if (state.nlExplanationText) {
      state.nlExplanationText.textContent = '';
    }
    if (state.nlExplanation) {
      state.nlExplanation.hidden = true;
    }
    if (state.nlExplanationLoader) {
      state.nlExplanationLoader.hidden = true;
    }
    if (state.nlExplanationBody) {
      state.nlExplanationBody.hidden = true;
    }
  }

  function showCustomExplanationLoading(state) {
    if (state.nlExplanationText) {
      state.nlExplanationText.textContent = '';
    }
    if (state.nlExplanation) {
      state.nlExplanation.hidden = false;
    }
    if (state.nlExplanationLoader) {
      state.nlExplanationLoader.hidden = false;
    }
    if (state.nlExplanationBody) {
      state.nlExplanationBody.hidden = true;
    }
  }

  function showCustomExplanationNarrative(state, narrative) {
    if (state.nlExplanationText) {
      state.nlExplanationText.textContent = narrative || '';
    }
    if (state.nlExplanation) {
      state.nlExplanation.hidden = false;
    }
    if (state.nlExplanationLoader) {
      state.nlExplanationLoader.hidden = true;
    }
    if (state.nlExplanationBody) {
      state.nlExplanationBody.hidden = false;
    }
  }

  function renderCustomExecution(state, execution, showNarrative) {
    if (state.nlSparql) {
      state.nlSparql.textContent = execution.sparql || (state.aiSession && state.aiSession.sparql) || '';
    }
    
    if (execution && execution.answer) {
      var origFacts = state.facts;
      var origSections = state.sections;
      state.facts = state.nlFacts;
      state.sections = state.nlSections;
      
      renderFacts(state, execution.answer.facts || []);
      renderSections(state, execution.answer);
      
      state.facts = origFacts;
      state.sections = origSections;
    }

    if (state.aiExplanationLoading) {
      showCustomExplanationLoading(state);
      return;
    }

    if (showNarrative && execution.answer && execution.answer.narrative) {
      showCustomExplanationNarrative(state, execution.answer.narrative);
    } else {
      hideCustomExplanation(state);
    }
  }

  function updateQuestionButtons(state) {
    if (!state.questionList) {
      return;
    }

    Array.prototype.forEach.call(state.questionList.querySelectorAll('[data-question-id]'), function (button) {
      var active = button.getAttribute('data-question-id') === state.selectedQuestionId;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function ensureAnswerVisible(state) {
    var anchor = state.answerTitle || state.sections || state.root;
    var rect;

    if (!anchor || typeof anchor.getBoundingClientRect !== 'function') {
      return;
    }

    rect = anchor.getBoundingClientRect();
    if (rect.top >= 72 && rect.top <= window.innerHeight * 0.4) {
      return;
    }

    anchor.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  function setRuntimeCard(card, heading, body) {
    var title;
    var text;

    if (!card) {
      return;
    }

    title = card.querySelector('strong');
    text = card.querySelector('p');

    if (title && typeof heading === 'string') {
      title.textContent = heading;
    }

    if (text && typeof body === 'string') {
      text.textContent = body;
    }
  }

  function setRuntimePill(state, message) {
    if (state.runtimePill) {
      state.runtimePill.textContent = message || '';
    }
  }

  function buildPredefinedDescriptor(state, question) {
    var visibleIndex = state.suggestedQuestions.indexOf(question);
    var sparql = state.data && typeof state.data.getQuestionSparql === 'function'
      ? state.data.getQuestionSparql(question, state.selectedLanguage)
      : (question.sparql || '');

    return {
      prompt: question.prompt,
      sparql: sparql,
      badgeLabel: 'Q-' + padIndex((visibleIndex >= 0 ? visibleIndex : state.questions.indexOf(question)) + 1),
      queryNote: 'Query template - ' + getSelectedLanguageLabel(state) + ' asana labels'
    };
  }

  function buildPlanningAnswer(session) {
    var plan = session.plan;
    var languageOption = global.SNEducationData && typeof global.SNEducationData.getLanguageOption === 'function'
      ? global.SNEducationData.getLanguageOption(session.language)
      : { label: session.language === 'te' ? 'Telugu' : 'Hindi' };
    var facts = [
      { label: 'Intent', value: plan.intent },
      { label: 'Confidence', value: Math.round(plan.confidence * 100) + '%' },
      { label: 'Gemini model', value: session.modelName },
      { label: 'Asana label language', value: languageOption.label }
    ];
    var sections = [
      {
        title: 'Planner rationale',
        items: [plan.rationale || 'Gemini mapped the question to the closest supported ontology template.']
      }
    ];

    if (plan.poseNumber) {
      facts.push({ label: 'Pose', value: 'Pose ' + plan.poseNumber });
    }
    if (plan.asanaLabel) {
      facts.push({ label: 'Asana', value: plan.asanaLabel });
    }

    return {
      narrative: 'The custom question has been mapped to "' + session.templateLabel +
        '". Review the generated SPARQL, then run the query to retrieve ontology-backed results before asking Gemini for a prose explanation.',
      facts: facts,
      sections: sections,
      table: null,
      visuals: []
    };
  }

  function updateAIControls(state) {
    var ready = Boolean(state.model);
    var hasQuestion = Boolean(compactText(state.aiQuestionInput && state.aiQuestionInput.value));
    var hasPlan = Boolean(state.aiSession && state.aiSession.plan);
    var busy = Boolean(state.aiBusy);

    setButtonDisabled(state.aiGenerateButton, !ready || !hasQuestion || busy);
    setButtonDisabled(state.aiRunButton, !ready || !hasPlan || busy);
    setButtonDisabled(state.aiExplainButton, !ready || !hasPlan || busy);
  }

  function setAIBusy(state, busy) {
    state.aiBusy = Boolean(busy);
    updateAIControls(state);
  }

  function clearCustomSelection(state) {
    state.selectedQuestionId = '';
    updateQuestionButtons(state);
  }

  function renderQuestion(state, questionId, options) {
    var question = state.questionsById[questionId];
    var answer;

    if (!state.model || !question) {
      return;
    }

    state.selectedQuestionId = questionId;
    state.lastPredefinedQuestionId = questionId;
    updateQuestionButtons(state);
    state.activeMode = 'predefined';
    setWorkspaceMode(state, 'predefined');
    if (window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', '#' + questionId);
    }

    try {
      answer = question.run(state.model, {
        language: state.selectedLanguage
      });
      renderAnswer(state, buildPredefinedDescriptor(state, question), answer);
      setAnswerView(state, 'answer');
      if (state.queryNote) {
        state.queryNote.textContent = 'Query template - ' + getSelectedLanguageLabel(state) + ' asana labels';
      }
      if (options && options.userInitiated) {
        ensureAnswerVisible(state);
      }
    } catch (error) {
      setStatus(state, 'Render failed');
      setError(state, error && error.message ? error.message : 'Unknown rendering error.');
    }
  }

  function renderQuestionList(state) {
    clearElement(state.questionList);
    if (!state.questionList) return;

    state.suggestedQuestions.forEach(function (question, index) {
      var button = createElement('button', 'education-question-button');
      var eyebrow = createElement('div', 'education-question-eyebrow');
      var number = createElement('span', '', 'Q-' + padIndex(index + 1));
      var tag = createElement('span', '', questionMeta(question.id));
      var title = createElement('strong', 'education-question-title', question.title);
      var prompt = createElement('p', 'education-question-prompt', question.prompt);

      button.type = 'button';
      button.setAttribute('data-question-id', question.id);
      button.setAttribute('aria-pressed', question.id === state.selectedQuestionId ? 'true' : 'false');
      button.title = question.prompt;

      eyebrow.appendChild(number);
      eyebrow.appendChild(tag);
      button.appendChild(eyebrow);
      button.appendChild(title);
      button.appendChild(prompt);

      button.addEventListener('click', function () {
        renderQuestion(state, question.id, { userInitiated: true });
      });

      state.questionList.appendChild(button);
    });
  }

  function updateStats(state) {
    var baseVariant = state.model.getBaseVariant();
    var basePoses = baseVariant ? state.model.getOrderedPosesForVariant(baseVariant) : [];

    if (state.statQuestions) {
      state.statQuestions.textContent = String(state.questions.length);
    }
    if (state.statVariants) {
      state.statVariants.textContent = String(state.model.variants.length);
    }
    if (state.statAsanas) {
      state.statAsanas.textContent = String(state.model.asanas.length);
    }
    if (state.statBasePoses) {
      state.statBasePoses.textContent = String(basePoses.length);
    }
  }

  function initializeLightbox(state) {
    if (!state.lightbox) {
      return;
    }

    if (state.lightboxClose) {
      state.lightboxClose.addEventListener('click', function () {
        closeLightbox(state);
      });
    }

    state.lightbox.addEventListener('click', function (event) {
      if (event.target === state.lightbox) {
        closeLightbox(state);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !state.lightbox.hidden) {
        closeLightbox(state);
      }
    });
  }

  function initializeAnswerViewToggle(state) {
    if (!state.answerViewToggle) {
      return;
    }

    state.answerViewToggle.addEventListener('click', function (event) {
      event.preventDefault();
      setAnswerView(state, state.currentAnswerView === 'query' ? 'answer' : 'query');
    });
  }

  function initializeNav() {
    var nav = byId('education-nav');
    var links;
    var sections;

    if (!nav) {
      return;
    }

    links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    sections = links
      .map(function (link) {
        return document.querySelector(link.getAttribute('href'));
      })
      .filter(Boolean);

    links.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var target = document.querySelector(link.getAttribute('href'));
        if (!target) {
          return;
        }
        event.preventDefault();
        window.scrollTo({
          top: target.offsetTop - 40,
          behavior: 'smooth'
        });
      });
    });

    window.addEventListener('scroll', function () {
      var currentId = sections.length ? sections[0].id : '';

      sections.forEach(function (section) {
        if (window.pageYOffset >= (section.offsetTop - 180)) {
          currentId = section.id;
        }
      });

      links.forEach(function (link) {
        link.classList.toggle('active', link.getAttribute('href') === '#' + currentId);
      });
    });
  }

  function initializeWorkspaceModeToggle(state) {
    if (state.customModeButton) {
      state.customModeButton.addEventListener('click', function () {
        setWorkspaceMode(state, 'custom');
      });
    }

    if (state.predefinedModeButton) {
      state.predefinedModeButton.addEventListener('click', function () {
        setWorkspaceMode(state, 'predefined');
      });
    }

    if (state.sparqlModeButton) {
      state.sparqlModeButton.addEventListener('click', function () {
        setWorkspaceMode(state, 'sparql');
      });
    }
  }

  function syncLanguageSelects(state) {
    if (!state.languageSelects) {
      return;
    }
    state.languageSelects.forEach(function (select) {
      select.value = state.selectedLanguage;
    });
  }

  function rerenderForLanguageChange(state) {
    if (state.workspaceMode === 'custom') {
      if (state.aiSession) {
        state.aiSession.sparql = state.ai && typeof state.ai.buildSparqlFromPlan === 'function'
          ? state.ai.buildSparqlFromPlan(state.model, state.aiSession.plan, state.selectedLanguage)
          : state.aiSession.sparql;
        if (state.nlSparql) {
          state.nlSparql.textContent = state.aiSession.sparql || '';
        }
      }
      if (state.aiExecution && state.ai && typeof state.ai.executePlan === 'function') {
        state.aiExecution = state.ai.executePlan({
          model: state.model,
          session: state.aiSession,
          questionText: state.aiSession ? state.aiSession.questionText : '',
          language: state.selectedLanguage
        });
        state.aiExplained = false;
      }
      if (state.aiExecution) {
        renderCustomExecution(state, state.aiExecution, Boolean(state.aiExplained));
      }
      return;
    }

    if (state.workspaceMode === 'sparql') {
      if (state.sparqlEditor && !state.sparqlHasUserEdited) {
        state.sparqlEditor.value = buildDefaultSparqlQuery(state);
      }
      return;
    }

    if (state.model && state.lastPredefinedQuestionId) {
      renderQuestion(state, state.lastPredefinedQuestionId);
    }
  }

  function initializeLanguageControls(state) {
    state.languageSelects = Array.prototype.slice.call(document.querySelectorAll('[data-education-language-select]'));
    if (!state.languageSelects.length) {
      return;
    }

    syncLanguageSelects(state);
    state.languageSelects.forEach(function (select) {
      select.addEventListener('change', function () {
        state.selectedLanguage = normalizeSelectedLanguage(state, select.value);
        syncLanguageSelects(state);
        rerenderForLanguageChange(state);
      });
    });
  }

  function runDirectSparql(state) {
    var queryText = state.sparqlEditor ? state.sparqlEditor.value : '';
    var result;

    if (!state.model) {
      setSparqlError(state, 'The ontology is still loading. Try again after the page reports that the ontology is ready.');
      return;
    }

    if (!compactText(queryText)) {
      setSparqlError(state, 'Enter a SELECT query before running the SPARQL editor.');
      return;
    }

    try {
      result = executeSparqlSelect(state.model, queryText);
      renderSparqlResult(state, result);
    } catch (error) {
      setSparqlError(state, error && error.message ? error.message : 'Unable to run the SPARQL query.');
    }
  }

  function resetDirectSparql(state) {
    if (state.sparqlEditor) {
      state.sparqlEditor.value = buildDefaultSparqlQuery(state);
      state.sparqlHasUserEdited = false;
    }
    clearSparqlResults(state);
  }

  function initializeSparqlWorkspace(state) {
    if (!state.sparqlEditor) {
      return;
    }

    state.sparqlEditor.value = buildDefaultSparqlQuery(state);
    state.sparqlHasUserEdited = false;
    clearSparqlResults(state);

    state.sparqlEditor.addEventListener('input', function () {
      state.sparqlHasUserEdited = true;
    });

    if (state.sparqlRunButton) {
      state.sparqlRunButton.addEventListener('click', function () {
        runDirectSparql(state);
      });
    }

    if (state.sparqlResetButton) {
      state.sparqlResetButton.addEventListener('click', function () {
        resetDirectSparql(state);
      });
    }

    if (state.sparqlClearButton) {
      state.sparqlClearButton.addEventListener('click', function () {
        clearSparqlResults(state);
      });
    }
  }

  function initializeAISuggestions(state) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ai-question]'), function (button) {
      button.addEventListener('click', function () {
        if (!state.aiQuestionInput) {
          return;
        }
        state.aiQuestionInput.value = button.getAttribute('data-ai-question') || '';
        state.aiQuestionInput.focus();
        updateAIControls(state);
      });
    });
  }

  function resetAIRuntime(state) {
    if (state.aiSession) {
      setAIStatus(state, 'Gemini active');
    } else {
      setAIStatus(state, 'Gemini idle');
    }
  }

  function syncApiKeyFromStorage(state) {
    if (!state.ai || !state.aiApiKeyInput) {
      return;
    }

    state.aiApiKeyInput.value = state.ai.loadApiKey();
  }

  function getCurrentQuestionText(state) {
    return compactText(state.aiQuestionInput && state.aiQuestionInput.value);
  }

  function getCurrentApiKey(state) {
    var fieldValue = compactText(state.aiApiKeyInput && state.aiApiKeyInput.value);
    return fieldValue || compactText(state.ai && state.ai.loadApiKey ? state.ai.loadApiKey() : '');
  }

  function getCurrentGeminiModel(state) {
    return compactText(state.aiModelSelect && state.aiModelSelect.value) || (state.ai ? state.ai.DEFAULT_MODEL : 'gemini-2.5-flash');
  }

  function clearAIComposer(state) {
    if (state.aiQuestionInput) {
      state.aiQuestionInput.value = '';
    }
    state.aiSession = null;
    state.aiExecution = null;
    state.aiExplained = false;
    state.aiExplanationLoading = false;
    setError(state, '');
    hideCustomExplanation(state);
    resetAIRuntime(state);
    updateAIControls(state);
  }

  function ensureCurrentPlan(state) {
    var questionText = getCurrentQuestionText(state);

    if (state.aiSession && state.aiSession.questionText === questionText) {
      return Promise.resolve(state.aiSession);
    }

    return generateCustomQuery(state);
  }

  function generateCustomQuery(state) {
    var questionText = getCurrentQuestionText(state);
    var apiKey = getCurrentApiKey(state);
    var geminiModel = getCurrentGeminiModel(state);

    if (!state.ai) {
      return Promise.reject(new Error('Gemini planner support is not available on this page.'));
    }

    setAIBusy(state, true);
    setError(state, '');
    setAIStatus(state, 'Generating SPARQL');

    return state.ai.planQuestion({
      model: state.model,
      questionText: questionText,
      apiKey: apiKey,
      modelName: geminiModel,
      language: state.selectedLanguage
    }).then(function (session) {
      state.ai.saveApiKey(apiKey);
      state.aiSession = session;
      state.aiExecution = null;
      state.aiExplained = false;
      state.aiExplanationLoading = false;
      state.activeMode = 'custom';
      setWorkspaceMode(state, 'custom');
      clearCustomSelection(state);
      hideCustomExplanation(state);

      if (state.nlStateWelcome) state.nlStateWelcome.style.display = 'none';
      if (state.nlStateResults) state.nlStateResults.style.display = 'none';
      if (state.nlStateSparql) state.nlStateSparql.style.display = 'flex';
      
      if (state.nlSparql) {
        state.nlSparql.textContent = session.sparql;
      }
      
      setAIStatus(state, 'SPARQL ready');
      /* Skipping runtime card updates */
      return session;
    }).catch(function (error) {
      setAIStatus(state, 'Gemini failed');
      setError(state, error && error.message ? error.message : 'Unknown Gemini planning error.');
      state.aiExplanationLoading = false;
      hideCustomExplanation(state);
      
      if (state.nlStateWelcome) state.nlStateWelcome.style.display = 'none';
      if (state.nlStateResults) state.nlStateResults.style.display = 'none';
      if (state.nlStateSparql) state.nlStateSparql.style.display = 'flex';
      if (state.nlSparql) state.nlSparql.textContent = "Error Generating Query:\n" + (error && error.message ? error.message : "Service Unavailable or Rate Limited");
      
      throw error;
    }).finally(function () {
      setAIBusy(state, false);
    });
  }

  function requestCustomExplanation(state, execution) {
    var apiKey = getCurrentApiKey(state);
    var geminiModel = getCurrentGeminiModel(state);

    state.aiExplanationLoading = true;
    state.aiExplained = false;
    setAIBusy(state, true);
    setError(state, '');
    setAIStatus(state, 'Generating explanation');
    renderCustomExecution(state, execution, false);

    return state.ai.explainExecution({
      apiKey: apiKey,
      modelName: geminiModel,
      questionText: state.aiSession.questionText,
      session: state.aiSession,
      execution: execution
    }).then(function (narrative) {
      execution.answer.narrative = narrative;
      state.aiExplained = true;
      setAIStatus(state, 'Explanation ready');
      return narrative;
    }).catch(function (error) {
      state.aiExplained = false;
      setAIStatus(state, 'Explanation failed');
      setError(state, error && error.message ? error.message : 'Unknown Gemini explanation error.');
      throw error;
    }).finally(function () {
      state.aiExplanationLoading = false;
      renderCustomExecution(state, execution, Boolean(state.aiExplained));
      setAIBusy(state, false);
    });
  }

  function startAutoExplanation(state, execution) {
    return requestCustomExplanation(state, execution).catch(function () {
      return null;
    });
  }

  function runCustomQuery(state) {
    return ensureCurrentPlan(state).then(function (session) {
      var execution;

      setAIBusy(state, true);
      setError(state, '');
      setAIStatus(state, 'Running query');

      try {
        execution = state.ai.executePlan({
          model: state.model,
          session: session,
          questionText: session.questionText,
          language: state.selectedLanguage
        });
      } catch (error) {
        setAIStatus(state, 'Execution failed');
        setError(state, error && error.message ? error.message : 'Unknown ontology execution error.');
        throw error;
      } finally {
        setAIBusy(state, false);
      }

      state.aiExecution = execution;
      state.aiExplained = false;
      renderCustomExecution(state, execution, false);
      
      if (state.nlStateSparql) state.nlStateSparql.style.display = 'none';
      if (state.nlStateResults) state.nlStateResults.style.display = 'flex';

      setAIStatus(state, 'Query executed');
      startAutoExplanation(state, execution);

      return execution;
    }).catch(function(error) {
      setError(state, error && error.message ? error.message : 'Unknown query execution error.');
      setAIStatus(state, 'Execution failed');
      throw error;
    });
  }

  function explainCustomQuery(state) {
    return ensureCurrentPlan(state).then(function () {
      return state.aiExecution ? Promise.resolve(state.aiExecution) : runCustomQuery(state);
    }).then(function (execution) {
      return requestCustomExplanation(state, execution);
    });
  }

  function initializeAIWorkspace(state) {
    if (!state.aiQuestionInput) {
      return;
    }

    syncApiKeyFromStorage(state);
    initializeAISuggestions(state);
    resetAIRuntime(state);
    setAIStatus(state, state.ai ? 'Gemini idle' : 'Gemini unavailable');

    if (state.aiQuestionInput) {
      state.aiQuestionInput.addEventListener('input', function () {
        updateAIControls(state);
      });
    }

    if (state.aiApiKeyInput && state.ai) {
      state.aiApiKeyInput.addEventListener('change', function () {
        state.ai.saveApiKey(state.aiApiKeyInput.value);
      });
      state.aiApiKeyInput.addEventListener('blur', function () {
        state.ai.saveApiKey(state.aiApiKeyInput.value);
      });
    }

    if (state.aiClearButton) {
      state.aiClearButton.addEventListener('click', function () {
        if (state.aiQuestionInput) {
          state.aiQuestionInput.value = '';
        }
        setError(state, '');
        state.aiSession = null;
        state.aiExecution = null;
        state.aiExplained = false;
        state.aiExplanationLoading = false;
        if (state.nlStateWelcome) state.nlStateWelcome.style.display = 'flex';
        if (state.nlStateSparql) state.nlStateSparql.style.display = 'none';
        if (state.nlStateResults) state.nlStateResults.style.display = 'none';
        hideCustomExplanation(state);
        resetAIRuntime(state);
        updateAIControls(state);
      });
    }

    if (state.aiGenerateButton) {
      state.aiGenerateButton.addEventListener('click', function () {
        generateCustomQuery(state).catch(function () {
          return null;
        });
      });
    }

    if (state.aiRunButton) {
      state.aiRunButton.addEventListener('click', function () {
        runCustomQuery(state).catch(function () {
          return null;
        });
      });
    }

    if (state.aiExplainButton) {
      state.aiExplainButton.addEventListener('click', function () {
        explainCustomQuery(state).catch(function () {
          return null;
        });
      });
    }

    if (state.nlToggleSparql) {
      state.nlToggleSparql.addEventListener('click', function () {
        if (state.nlStateSparql.style.display === 'none') {
          // Switch to SPARQL
          state.nlStateSparql.style.display = 'flex';
          state.nlStateResults.style.display = 'none';
          state.nlToggleSparql.textContent = 'View Results';
          // Move the toggle button to SPARQL header
          state.nlStateSparql.querySelector('.education-panel-header').appendChild(state.nlToggleSparql);
        } else {
          // Switch to Results
          state.nlStateSparql.style.display = 'none';
          state.nlStateResults.style.display = 'flex';
          state.nlToggleSparql.textContent = 'View SPARQL';
          // Move the toggle button back to Results header
          state.nlStateResults.querySelector('.education-panel-header').appendChild(state.nlToggleSparql);
        }
      });
    }

    updateAIControls(state);
  }

  function mount() {
    var root = document.querySelector('[data-education-app]');
    var deps = global.SNOntologyGraph && global.SNEducationData ? {
      graph: global.SNOntologyGraph,
      data: global.SNEducationData,
      ai: global.SNEducationAI || null
    } : null;
    var state;

    if (!root || !deps) {
      return null;
    }

    state = {
      root: root,
      graph: deps.graph,
      data: deps.data,
      ai: deps.ai,
      questions: deps.data.QUESTIONS.slice(),
      suggestedQuestions: getSuggestedQuestions(deps.data.QUESTIONS),
      questionsById: deps.data.QUESTIONS.reduce(function (accumulator, question) {
        accumulator[question.id] = question;
        return accumulator;
      }, {}),
      selectedQuestionId: getInitialQuestionId(deps.data.QUESTIONS),
      lastPredefinedQuestionId: getInitialQuestionId(deps.data.QUESTIONS),
      model: null,
      status: byId('education-status'),
      aiStatus: byId('education-ai-status'),
      runtimePill: byId('education-runtime-pill'),
      answerTitle: byId('education-answer-title'),
      answerText: byId('education-answer-text'),
      facts: byId('education-facts'),
      sections: byId('education-sections'),
      sparql: byId('education-sparql'),
      queryNote: byId('education-query-note'),
      visuals: byId('education-visuals'),
      visualNote: byId('education-visual-note'),
      layout: root.querySelector('.education-layout'),
      questionList: byId('education-question-list'),
      composerPanel: byId('education-composer-panel'),
      predefinedPanel: byId('education-predefined-panel'),
      customModeButton: byId('education-mode-custom'),
      predefinedModeButton: byId('education-mode-predefined'),
      sparqlModeButton: byId('education-mode-sparql'),
      answerPanel: document.querySelector('.education-answer-panel'),
      error: byId('education-error'),
      activeQuestionId: byId('education-active-question-id'),
      answerContent: byId('education-answer-content'),
      queryView: byId('education-query-view'),
      answerViewToggle: byId('education-answer-view-toggle'),
      lightbox: byId('education-lightbox'),
      lightboxClose: byId('education-lightbox-close'),
      lightboxImage: byId('education-lightbox-image'),
      lightboxCaption: byId('education-lightbox-caption'),
      aiForm: byId('education-ai-form'),
      aiQuestionInput: byId('education-ai-question'),
      aiApiKeyInput: byId('education-api-key'),
      aiModelSelect: byId('education-ai-model'),
      aiClearButton: byId('education-ai-clear'),
      aiGenerateButton: byId('education-ai-generate'),
      aiRunButton: byId('education-ai-run'),
      aiExplainButton: byId('education-ai-explain'),
      nlInterface: byId('nl-interface-wrapper'),
      predefinedInterface: byId('predefined-interface-wrapper'),
      sparqlInterface: byId('sparql-interface-wrapper'),
      nlStateWelcome: byId('nl-state-welcome'),
      nlStateSparql: byId('nl-state-sparql'),
      nlStateResults: byId('nl-state-results'),
      nlToggleSparql: byId('nl-toggle-sparql'),
      nlSparql: byId('education-nl-sparql'),
      nlTabularResults: byId('education-nl-tabular-results'),
      nlFacts: byId('education-nl-facts'),
      nlSections: byId('education-nl-sections'),
      nlExplanation: byId('education-nl-explanation'),
      nlExplanationLoader: byId('education-nl-explanation-loading'),
      nlExplanationBody: byId('education-nl-explanation-body'),
      nlExplanationText: byId('education-nl-explanation-text'),
      nlError: byId('education-nl-error'),
      sparqlEditor: byId('education-sparql-editor'),
      sparqlRunButton: byId('education-sparql-run'),
      sparqlResetButton: byId('education-sparql-reset'),
      sparqlClearButton: byId('education-sparql-clear'),
      sparqlError: byId('education-sparql-error'),
      sparqlFacts: byId('education-sparql-facts'),
      sparqlSections: byId('education-sparql-sections'),
      sparqlEmpty: byId('education-sparql-empty'),
      sparqlResultsTitle: byId('education-sparql-results-title'),
      sparqlResultNote: byId('education-sparql-result-note'),
      runtimeStatusCard: byId('education-runtime-status'),
      runtimeTemplateCard: byId('education-runtime-template'),
      runtimeResultCard: byId('education-runtime-result'),
      currentAnswerView: 'answer',
      workspaceMode: 'predefined',
      activeMode: 'predefined',
      selectedLanguage: deps.data.DEFAULT_LANGUAGE || 'hi',
      languageSelects: [],
      aiBusy: false,
      aiSession: null,
      aiExecution: null,
      aiExplained: false,
      aiExplanationLoading: false,
      sparqlHasUserEdited: false,
      asanaThemeMap: {},
      asanaThemeMapInitialized: false,
      variantThemeMap: {},
      variantThemeMapInitialized: false,
      statQuestions: byId('stat-questions'),
      statVariants: byId('stat-variants'),
      statAsanas: byId('stat-asanas'),
      statBasePoses: byId('stat-base-poses')
    };

    initializeNav();
    initializeLightbox(state);
    initializeAnswerViewToggle(state);
    initializeWorkspaceModeToggle(state);
    initializeLanguageControls(state);
    initializeSparqlWorkspace(state);
    initializeAIWorkspace(state);
    setAnswerView(state, 'answer');
    setWorkspaceMode(state, 'predefined');
    renderQuestionList(state);
    setStatus(state, 'Loading ontology');
    setError(state, '');
    updateAIControls(state);

    deps.graph.load({
      ontologySrc: root.dataset.ontologySrc,
      cypImageBase: root.dataset.cypImageBase
    }).then(function (model) {
      state.model = model;
      state.asanaThemeMap = {};
      state.asanaThemeMapInitialized = false;
      state.variantThemeMap = {};
      state.variantThemeMapInitialized = false;
      initializeAsanaThemeMap(state);
      initializeVariantThemeMap(state);
      updateStats(state);
      updateAIControls(state);
      setStatus(state, 'Ontology ready');
      if (!state.ai) {
        setAIStatus(state, 'Gemini unavailable');
      }
      renderQuestion(state, state.selectedQuestionId);
    }).catch(function (error) {
      setStatus(state, 'Load failed');
      setAIStatus(state, 'Ontology failed');
      setError(state, error && error.message ? error.message : 'Unknown ontology loading error.');
      renderVisuals(state, []);
      updateAIControls(state);
    });

    return state;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}(window));
