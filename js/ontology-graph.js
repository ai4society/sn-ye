(function (global) {
  'use strict';

  var RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
  var RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
  var OWL_NS = 'http://www.w3.org/2002/07/owl#';
  var XML_NS = 'http://www.w3.org/XML/1998/namespace';
  var CORE_NS = 'http://example.org/suryanamaskar/core#';

  var DEFAULTS = {
    ontologySrc: 'models/master.owl',
    cypImageBase: 'images/cyp-pages'
  };

  var PREDICATES = {
    type: RDF_NS + 'type',
    label: RDFS_NS + 'label',
    comment: RDFS_NS + 'comment',
    belongsToVariant: CORE_NS + 'belongsToVariant',
    hasAsana: CORE_NS + 'hasAsana',
    hasBreathingPattern: CORE_NS + 'hasBreathingPattern',
    hasConstraint: CORE_NS + 'hasConstraint',
    hasCorrection: CORE_NS + 'hasCorrection',
    hasInversePose: CORE_NS + 'hasInversePose',
    hasNextPose: CORE_NS + 'hasNextPose',
    hasPossibleError: CORE_NS + 'hasPossibleError',
    hasPreviousPose: CORE_NS + 'hasPreviousPose',
    hasRule: CORE_NS + 'hasRule',
    involvesBodyPart: CORE_NS + 'involvesBodyPart',
    repeatsPose: CORE_NS + 'repeatsPose',
    sameAsanaAs: CORE_NS + 'sameAsanaAs',
    constraintDescription: CORE_NS + 'constraintDescription',
    correctionText: CORE_NS + 'correctionText',
    errorDescription: CORE_NS + 'errorDescription',
    hasAlternateName: CORE_NS + 'hasAlternateName',
    hasCYPPage: CORE_NS + 'hasCYPPage',
    hasChakra: CORE_NS + 'hasChakra',
    hasLaterality: CORE_NS + 'hasLaterality',
    hasMantra: CORE_NS + 'hasMantra',
    hasSafetyNote: CORE_NS + 'hasSafetyNote',
    hasSupportType: CORE_NS + 'hasSupportType',
    poseNumber: CORE_NS + 'poseNumber',
    ruleDescription: CORE_NS + 'ruleDescription'
  };

  var TYPES = {
    Asana: CORE_NS + 'Asana',
    BodyPart: CORE_NS + 'BodyPart',
    BreathingPattern: CORE_NS + 'BreathingPattern',
    CorrectionInstruction: CORE_NS + 'CorrectionInstruction',
    Pose: CORE_NS + 'Pose',
    PoseConstraint: CORE_NS + 'PoseConstraint',
    PoseError: CORE_NS + 'PoseError',
    PostureRule: CORE_NS + 'PostureRule',
    Variant: CORE_NS + 'Variant'
  };

  var cache = Object.create(null);

  function createDictionary() {
    return Object.create(null);
  }

  function isElement(node) {
    return Boolean(node && node.nodeType === 1);
  }

  function childElements(node) {
    var children = [];
    var current = node ? node.firstElementChild : null;
    while (current) {
      children.push(current);
      current = current.nextElementSibling;
    }
    return children;
  }

  function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeKey(value) {
    return normalizeWhitespace(value).toLowerCase();
  }

  function fragmentFromUri(uri) {
    var source = String(uri || '');
    if (!source) {
      return '';
    }
    var hashIndex = source.lastIndexOf('#');
    if (hashIndex >= 0 && hashIndex < source.length - 1) {
      return source.slice(hashIndex + 1);
    }
    var slashIndex = source.lastIndexOf('/');
    if (slashIndex >= 0 && slashIndex < source.length - 1) {
      return source.slice(slashIndex + 1);
    }
    return source;
  }

  function joinPath(base, tail) {
    var cleanBase = String(base || '').replace(/\/+$/, '');
    var cleanTail = String(tail || '').replace(/^\/+/, '');
    return cleanBase ? cleanBase + '/' + cleanTail : cleanTail;
  }

  function prettifyIdentifier(value) {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\bVariant0?(\d+)\b/g, 'Variant $1')
      .replace(/\bBaseSN\b/g, 'Base SN')
      .trim();
  }

  function createEntity(uri) {
    return {
      uri: uri,
      id: fragmentFromUri(uri),
      links: createDictionary(),
      literals: createDictionary()
    };
  }

  function ensureEntity(entities, uri) {
    if (!uri) {
      return null;
    }
    if (!entities[uri]) {
      entities[uri] = createEntity(uri);
    }
    return entities[uri];
  }

  function addUniqueValue(list, value, signature) {
    var index;
    for (index = 0; index < list.length; index += 1) {
      if (signature(list[index]) === signature(value)) {
        return;
      }
    }
    list.push(value);
  }

  function addLink(entity, predicate, objectUri) {
    var bucket;
    if (!entity || !predicate || !objectUri) {
      return;
    }
    bucket = entity.links[predicate] || (entity.links[predicate] = []);
    if (bucket.indexOf(objectUri) === -1) {
      bucket.push(objectUri);
    }
  }

  function addLiteral(entity, predicate, value, datatype, language) {
    var bucket;
    if (!entity || !predicate || value === '') {
      return;
    }
    bucket = entity.literals[predicate] || (entity.literals[predicate] = []);
    addUniqueValue(bucket, {
      value: value,
      datatype: datatype || '',
      language: language || ''
    }, function (entry) {
      return entry.value + '|' + entry.datatype + '|' + entry.language;
    });
  }

  function resolveUri(value, xmlBase) {
    var source = String(value || '');
    if (!source) {
      return '';
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(source)) {
      return source;
    }
    if (source.charAt(0) === '#' && xmlBase) {
      return String(xmlBase).replace(/#.*$/, '') + source;
    }
    return source;
  }

  function getAttributeValue(element, namespaceUri, localName, qualifiedName) {
    return element.getAttributeNS(namespaceUri, localName) || element.getAttribute(qualifiedName) || '';
  }

  function getResourceUri(element, xmlBase) {
    var about = getAttributeValue(element, RDF_NS, 'about', 'rdf:about');
    var resourceId = getAttributeValue(element, RDF_NS, 'ID', 'rdf:ID');
    var nodeId = getAttributeValue(element, RDF_NS, 'nodeID', 'rdf:nodeID');
    if (about) {
      return resolveUri(about, xmlBase);
    }
    if (resourceId) {
      return (xmlBase || '') + '#' + resourceId;
    }
    if (nodeId) {
      return '_:' + nodeId;
    }
    return '';
  }

  function inferTypeUri(element) {
    if (!element || !element.namespaceURI || !element.localName) {
      return '';
    }
    if (element.namespaceURI === CORE_NS) {
      return element.namespaceURI + element.localName;
    }
    return '';
  }

  function parsePropertyElement(subjectEntity, propertyElement, state) {
    var predicateUri;
    var datatype;
    var language;
    var resource;
    var nested;
    var nestedSubjectUri;
    var textValue;

    if (!subjectEntity || !isElement(propertyElement)) {
      return;
    }

    predicateUri = propertyElement.namespaceURI && propertyElement.localName
      ? propertyElement.namespaceURI + propertyElement.localName
      : '';

    if (!predicateUri) {
      return;
    }

    resource = getAttributeValue(propertyElement, RDF_NS, 'resource', 'rdf:resource');
    if (resource) {
      addLink(subjectEntity, predicateUri, resolveUri(resource, state.xmlBase));
      return;
    }

    nested = childElements(propertyElement);
    if (nested.length) {
      nested.forEach(function (nestedElement) {
        nestedSubjectUri = parseResourceElement(nestedElement, state);
        if (nestedSubjectUri) {
          addLink(subjectEntity, predicateUri, nestedSubjectUri);
        }
      });
      return;
    }

    textValue = normalizeWhitespace(propertyElement.textContent);
    if (!textValue) {
      return;
    }

    datatype = getAttributeValue(propertyElement, RDF_NS, 'datatype', 'rdf:datatype');
    language = getAttributeValue(propertyElement, XML_NS, 'lang', 'xml:lang');
    addLiteral(subjectEntity, predicateUri, textValue, datatype, language);
  }

  function parseResourceElement(element, state) {
    var subjectUri;
    var subjectEntity;
    var inferredType;

    if (!isElement(element)) {
      return '';
    }

    subjectUri = getResourceUri(element, state.xmlBase);
    if (!subjectUri) {
      return '';
    }

    subjectEntity = ensureEntity(state.entities, subjectUri);
    inferredType = inferTypeUri(element);
    if (inferredType) {
      addLink(subjectEntity, PREDICATES.type, inferredType);
    }

    childElements(element).forEach(function (propertyElement) {
      parsePropertyElement(subjectEntity, propertyElement, state);
    });

    return subjectUri;
  }

  function parseOntologyText(xmlText, options) {
    var parser = new DOMParser();
    var documentNode = parser.parseFromString(xmlText, 'application/xml');
    var parserErrors = documentNode.getElementsByTagName('parsererror');
    var root = documentNode.documentElement;
    var state;

    if (parserErrors.length) {
      throw new Error(normalizeWhitespace(parserErrors[0].textContent) || 'Unable to parse RDF/XML.');
    }

    state = {
      entities: createDictionary(),
      xmlBase: (root && root.getAttribute('xml:base')) || ''
    };

    childElements(root).forEach(function (element) {
      parseResourceElement(element, state);
    });

    return buildModel(state.entities, options || {});
  }

  function getLiteralEntries(entity, predicate) {
    return entity && entity.literals[predicate] ? entity.literals[predicate].slice() : [];
  }

  function getLiteralValues(entity, predicate) {
    return getLiteralEntries(entity, predicate).map(function (entry) {
      return entry.value;
    });
  }

  function getFirstLiteral(entity, predicate) {
    var values = getLiteralValues(entity, predicate);
    return values.length ? values[0] : '';
  }

  function getLiteralMap(entity, predicate) {
    var map = createDictionary();
    getLiteralEntries(entity, predicate).forEach(function (entry) {
      var language = normalizeKey(entry.language);
      if (language && !map[language]) {
        map[language] = entry.value;
      }
    });
    return map;
  }

  function getFirstLiteralByLanguage(entity, predicate, language) {
    var targetLanguage = normalizeKey(language);
    var entries;
    var match;

    if (!targetLanguage) {
      return getFirstLiteral(entity, predicate);
    }

    entries = getLiteralEntries(entity, predicate);
    match = entries.find(function (entry) {
      return normalizeKey(entry.language) === targetLanguage;
    }) || entries.find(function (entry) {
      var entryLanguage = normalizeKey(entry.language);
      return entryLanguage && (
        entryLanguage.indexOf(targetLanguage + '-') === 0 ||
        targetLanguage.indexOf(entryLanguage + '-') === 0
      );
    });

    return match ? match.value : '';
  }

  function getFirstLiteralWithLanguageFallback(entity, predicate, language) {
    return getFirstLiteralByLanguage(entity, predicate, language) ||
      getFirstLiteralByLanguage(entity, predicate, 'en') ||
      getFirstLiteral(entity, predicate);
  }

  function getLinkValues(entity, predicate) {
    return entity && entity.links[predicate] ? entity.links[predicate].slice() : [];
  }

  function buildTriples(entities) {
    var triples = [];

    Object.keys(entities || {}).forEach(function (subjectUri) {
      var entity = entities[subjectUri];

      Object.keys(entity.links || {}).forEach(function (predicateUri) {
        entity.links[predicateUri].forEach(function (objectUri) {
          triples.push({
            subject: subjectUri,
            predicate: predicateUri,
            object: {
              termType: 'NamedNode',
              value: objectUri
            }
          });
        });
      });

      Object.keys(entity.literals || {}).forEach(function (predicateUri) {
        entity.literals[predicateUri].forEach(function (literal) {
          triples.push({
            subject: subjectUri,
            predicate: predicateUri,
            object: {
              termType: 'Literal',
              value: literal.value,
              datatype: literal.datatype || '',
              language: literal.language || ''
            }
          });
        });
      });
    });

    return triples;
  }

  function hasType(entity, typeUri) {
    return getLinkValues(entity, PREDICATES.type).indexOf(typeUri) !== -1;
  }

  function compareStrings(left, right) {
    return String(left || '').localeCompare(String(right || ''));
  }

  function compareNumbers(left, right) {
    return Number(left || 0) - Number(right || 0);
  }

  function buildModel(entities, options) {
    var mergedOptions = {
      ontologySrc: options.ontologySrc || DEFAULTS.ontologySrc,
      cypImageBase: options.cypImageBase || DEFAULTS.cypImageBase
    };
    var triples = buildTriples(entities);
    var entityList = Object.keys(entities).map(function (uri) {
      return entities[uri];
    });
    var asanas = [];
    var bodyParts = [];
    var breathingPatterns = [];
    var corrections = [];
    var errors = [];
    var poses = [];
    var rules = [];
    var constraints = [];
    var variants = [];
    var asanasByUri = createDictionary();
    var bodyPartsByUri = createDictionary();
    var breathingPatternsByUri = createDictionary();
    var correctionsByUri = createDictionary();
    var errorsByUri = createDictionary();
    var posesByUri = createDictionary();
    var rulesByUri = createDictionary();
    var constraintsByUri = createDictionary();
    var variantsByUri = createDictionary();

    function getEntity(uri) {
      return entities[uri] || null;
    }

    function getEntityLabel(uri, language) {
      var entity = getEntity(uri);
      var label = entity ? getFirstLiteralWithLanguageFallback(entity, PREDICATES.label, language || 'en') : '';
      return label || prettifyIdentifier(fragmentFromUri(uri));
    }

    function getEntityLabelsByLanguage(uri) {
      var entity = getEntity(uri);
      var labels = entity ? getLiteralMap(entity, PREDICATES.label) : createDictionary();
      if (!labels.en) {
        labels.en = getEntityLabel(uri, 'en');
      }
      return labels;
    }

    function getEntityComment(uri) {
      var entity = getEntity(uri);
      return entity ? getFirstLiteral(entity, PREDICATES.comment) : '';
    }

    function getDisplayVariantLabel(uri) {
      var label = getEntityLabel(uri, 'en');
      if (label === 'BaseSN_SivanandaYogaVedantaCentre') {
        return 'Base SN (Sivananda Yoga Vedanta Centre, used at IIT BHU)';
      }
      return prettifyIdentifier(label);
    }

    function createVisual(asanaRecord) {
      if (!asanaRecord || !asanaRecord.cypPage) {
        return null;
      }
      return {
        kind: 'cyp-page',
        asanaUri: asanaRecord.uri,
        asanaLabel: asanaRecord.label,
        page: asanaRecord.cypPage,
        src: joinPath(mergedOptions.cypImageBase, 'cyp-' + asanaRecord.cypPage + '.png'),
        alt: asanaRecord.label + ' visual reference from CYP page ' + asanaRecord.cypPage,
        caption: 'CYP page ' + asanaRecord.cypPage
      };
    }

    function buildAsana(entity) {
      var labelsByLanguage = getEntityLabelsByLanguage(entity.uri);
      var record = {
        uri: entity.uri,
        id: entity.id,
        label: labelsByLanguage.en || getEntityLabel(entity.uri, 'en'),
        labelEn: labelsByLanguage.en || '',
        labelHi: labelsByLanguage.hi || '',
        labelTe: labelsByLanguage.te || '',
        labelsByLanguage: labelsByLanguage,
        alternateNames: getLiteralValues(entity, PREDICATES.hasAlternateName),
        sameAsanaUris: getLinkValues(entity, PREDICATES.sameAsanaAs),
        cypPage: getFirstLiteral(entity, PREDICATES.hasCYPPage)
      };
      record.visual = createVisual(record);
      return record;
    }

    function buildBodyPart(entity) {
      var labelsByLanguage = getEntityLabelsByLanguage(entity.uri);
      return {
        uri: entity.uri,
        id: entity.id,
        label: labelsByLanguage.en || getEntityLabel(entity.uri, 'en'),
        labelsByLanguage: labelsByLanguage
      };
    }

    function buildBreathingPattern(entity) {
      var labelsByLanguage = getEntityLabelsByLanguage(entity.uri);
      return {
        uri: entity.uri,
        id: entity.id,
        label: labelsByLanguage.en || getEntityLabel(entity.uri, 'en'),
        labelEn: labelsByLanguage.en || '',
        labelHi: labelsByLanguage.hi || '',
        labelTe: labelsByLanguage.te || '',
        labelsByLanguage: labelsByLanguage
      };
    }

    function buildCorrection(entity) {
      return {
        uri: entity.uri,
        id: entity.id,
        label: getEntityLabel(entity.uri, 'en'),
        text: getFirstLiteral(entity, PREDICATES.correctionText)
      };
    }

    function buildError(entity) {
      return {
        uri: entity.uri,
        id: entity.id,
        label: getEntityLabel(entity.uri, 'en'),
        description: getFirstLiteral(entity, PREDICATES.errorDescription),
        correctionUris: getLinkValues(entity, PREDICATES.hasCorrection)
      };
    }

    function buildRule(entity) {
      return {
        uri: entity.uri,
        id: entity.id,
        label: getEntityLabel(entity.uri, 'en'),
        description: getFirstLiteral(entity, PREDICATES.ruleDescription)
      };
    }

    function buildConstraint(entity) {
      return {
        uri: entity.uri,
        id: entity.id,
        label: getEntityLabel(entity.uri, 'en'),
        description: getFirstLiteral(entity, PREDICATES.constraintDescription)
      };
    }

    function buildVariant(entity) {
      var labelsByLanguage = getEntityLabelsByLanguage(entity.uri);
      return {
        uri: entity.uri,
        id: entity.id,
        label: labelsByLanguage.en || getEntityLabel(entity.uri, 'en'),
        displayLabel: getDisplayVariantLabel(entity.uri),
        labelsByLanguage: labelsByLanguage,
        comment: getEntityComment(entity.uri)
      };
    }

    function buildPose(entity) {
      var poseNumber = Number(getFirstLiteral(entity, PREDICATES.poseNumber) || 0);
      var variantUri = getLinkValues(entity, PREDICATES.belongsToVariant)[0] || '';
      var asanaUri = getLinkValues(entity, PREDICATES.hasAsana)[0] || '';
      var breathingPatternUri = getLinkValues(entity, PREDICATES.hasBreathingPattern)[0] || '';
      var asanaLabelsByLanguage = asanaUri ? getEntityLabelsByLanguage(asanaUri) : createDictionary();
      var breathingPatternLabelsByLanguage = breathingPatternUri
        ? getEntityLabelsByLanguage(breathingPatternUri)
        : createDictionary();
      var safetyNotes = getLiteralValues(entity, PREDICATES.hasSafetyNote);
      return {
        uri: entity.uri,
        id: entity.id,
        label: getEntityLabel(entity.uri, 'en'),
        poseNumber: poseNumber || null,
        variantUri: variantUri,
        variantLabel: variantUri ? getDisplayVariantLabel(variantUri) : '',
        asanaUri: asanaUri,
        asanaLabel: asanaUri ? (asanaLabelsByLanguage.en || getEntityLabel(asanaUri, 'en')) : '',
        asanaLabelEn: asanaLabelsByLanguage.en || '',
        asanaLabelHi: asanaLabelsByLanguage.hi || '',
        asanaLabelTe: asanaLabelsByLanguage.te || '',
        asanaLabelsByLanguage: asanaLabelsByLanguage,
        breathingPatternUri: breathingPatternUri,
        breathingPatternLabel: breathingPatternUri
          ? (breathingPatternLabelsByLanguage.en || getEntityLabel(breathingPatternUri, 'en'))
          : '',
        breathingPatternLabelEn: breathingPatternLabelsByLanguage.en || '',
        breathingPatternLabelHi: breathingPatternLabelsByLanguage.hi || '',
        breathingPatternLabelTe: breathingPatternLabelsByLanguage.te || '',
        breathingPatternLabelsByLanguage: breathingPatternLabelsByLanguage,
        safetyNote: safetyNotes[0] || '',
        safetyNotes: safetyNotes,
        laterality: getFirstLiteral(entity, PREDICATES.hasLaterality),
        supportType: getFirstLiteral(entity, PREDICATES.hasSupportType),
        chakra: getFirstLiteral(entity, PREDICATES.hasChakra),
        mantra: getFirstLiteral(entity, PREDICATES.hasMantra),
        nextPoseUris: getLinkValues(entity, PREDICATES.hasNextPose),
        previousPoseUris: getLinkValues(entity, PREDICATES.hasPreviousPose),
        repeatedPoseUris: getLinkValues(entity, PREDICATES.repeatsPose),
        inversePoseUris: getLinkValues(entity, PREDICATES.hasInversePose),
        ruleUris: getLinkValues(entity, PREDICATES.hasRule),
        constraintUris: getLinkValues(entity, PREDICATES.hasConstraint),
        errorUris: getLinkValues(entity, PREDICATES.hasPossibleError),
        bodyPartUris: getLinkValues(entity, PREDICATES.involvesBodyPart)
      };
    }

    entityList.forEach(function (entity) {
      if (hasType(entity, TYPES.Asana)) {
        asanas.push(buildAsana(entity));
      }
      if (hasType(entity, TYPES.BodyPart)) {
        bodyParts.push(buildBodyPart(entity));
      }
      if (hasType(entity, TYPES.BreathingPattern)) {
        breathingPatterns.push(buildBreathingPattern(entity));
      }
      if (hasType(entity, TYPES.CorrectionInstruction)) {
        corrections.push(buildCorrection(entity));
      }
      if (hasType(entity, TYPES.PoseError)) {
        errors.push(buildError(entity));
      }
      if (hasType(entity, TYPES.Pose)) {
        poses.push(buildPose(entity));
      }
      if (hasType(entity, TYPES.PostureRule)) {
        rules.push(buildRule(entity));
      }
      if (hasType(entity, TYPES.PoseConstraint)) {
        constraints.push(buildConstraint(entity));
      }
      if (hasType(entity, TYPES.Variant)) {
        variants.push(buildVariant(entity));
      }
    });

    asanas.sort(function (left, right) {
      return compareStrings(left.label, right.label);
    });
    bodyParts.sort(function (left, right) {
      return compareStrings(left.label, right.label);
    });
    breathingPatterns.sort(function (left, right) {
      return compareStrings(left.label, right.label);
    });
    corrections.sort(function (left, right) {
      return compareStrings(left.label, right.label);
    });
    errors.sort(function (left, right) {
      return compareStrings(left.label, right.label);
    });
    rules.sort(function (left, right) {
      return compareStrings(left.label, right.label);
    });
    constraints.sort(function (left, right) {
      return compareStrings(left.label, right.label);
    });
    variants.sort(function (left, right) {
      return compareStrings(left.displayLabel, right.displayLabel);
    });
    poses.sort(function (left, right) {
      return compareNumbers(left.poseNumber, right.poseNumber) || compareStrings(left.label, right.label);
    });

    asanas.forEach(function (record) {
      asanasByUri[record.uri] = record;
    });
    bodyParts.forEach(function (record) {
      bodyPartsByUri[record.uri] = record;
    });
    breathingPatterns.forEach(function (record) {
      breathingPatternsByUri[record.uri] = record;
    });
    corrections.forEach(function (record) {
      correctionsByUri[record.uri] = record;
    });
    errors.forEach(function (record) {
      errorsByUri[record.uri] = record;
    });
    rules.forEach(function (record) {
      rulesByUri[record.uri] = record;
    });
    constraints.forEach(function (record) {
      constraintsByUri[record.uri] = record;
    });
    variants.forEach(function (record) {
      variantsByUri[record.uri] = record;
    });
    poses.forEach(function (record) {
      posesByUri[record.uri] = record;
    });

    function uniqueByKey(items, keyFn) {
      var seen = createDictionary();
      var output = [];
      items.forEach(function (item) {
        var key = keyFn(item);
        if (!key || seen[key]) {
          return;
        }
        seen[key] = true;
        output.push(item);
      });
      return output;
    }

    function findRecord(records, ref) {
      var key = normalizeKey(ref);
      if (!key) {
        return null;
      }
      return records.find(function (record) {
        var values = [
          record.uri,
          record.id,
          record.label,
          record.displayLabel
        ];

        Object.keys(record.labelsByLanguage || {}).forEach(function (language) {
          values.push(record.labelsByLanguage[language]);
        });

        return values.some(function (value) {
          return normalizeKey(value) === key;
        });
      }) || null;
    }

    function getLanguageLabel(record, language) {
      var preferredLanguage = normalizeKey(language);
      var labels = record && record.labelsByLanguage ? record.labelsByLanguage : {};

      if (!record) {
        return '';
      }
      if (preferredLanguage && labels[preferredLanguage]) {
        return labels[preferredLanguage];
      }
      return labels.en || record.label || '';
    }

    function getBaseVariant() {
      return variants.find(function (variant) {
        return variant.uri.indexOf('/base-sn#') !== -1;
      }) || variants.find(function (variant) {
        return normalizeKey(variant.label).indexOf('basesn') === 0;
      }) || null;
    }

    function getVariant(ref) {
      return findRecord(variants, ref);
    }

    function getAsana(ref) {
      return findRecord(asanas, ref);
    }

    function getPose(ref) {
      return findRecord(poses, ref);
    }

    function getError(ref) {
      return findRecord(errors, ref);
    }

    function getRule(ref) {
      return findRecord(rules, ref);
    }

    function getConstraint(ref) {
      return findRecord(constraints, ref);
    }

    function getCorrection(ref) {
      return findRecord(corrections, ref);
    }

    function getBodyPart(ref) {
      return findRecord(bodyParts, ref);
    }

    function getBreathingPattern(ref) {
      return findRecord(breathingPatterns, ref);
    }

    function getAsanaLabel(asanaRef, language) {
      var asana = typeof asanaRef === 'string' ? getAsana(asanaRef) : asanaRef;
      return getLanguageLabel(asana, language);
    }

    function getBreathingPatternLabel(breathingPatternRef, language) {
      var breathingPattern = typeof breathingPatternRef === 'string'
        ? getBreathingPattern(breathingPatternRef)
        : breathingPatternRef;
      return getLanguageLabel(breathingPattern, language);
    }

    function getOrderedPosesForVariant(variantRef) {
      var variant = typeof variantRef === 'string' ? getVariant(variantRef) : variantRef;
      if (!variant) {
        return [];
      }
      return poses
        .filter(function (pose) {
          return pose.variantUri === variant.uri;
        })
        .slice()
        .sort(function (left, right) {
          return compareNumbers(left.poseNumber, right.poseNumber) || compareStrings(left.label, right.label);
        });
    }

    function getPoseByNumber(variantRef, poseNumber) {
      var numericPoseNumber = Number(poseNumber || 0);
      return getOrderedPosesForVariant(variantRef).find(function (pose) {
        return pose.poseNumber === numericPoseNumber;
      }) || null;
    }

    function getPosesForAsana(asanaRef, variantRef) {
      var asana = typeof asanaRef === 'string' ? getAsana(asanaRef) : asanaRef;
      var relevantPoses = variantRef ? getOrderedPosesForVariant(variantRef) : poses.slice();

      if (!asana) {
        return [];
      }

      return relevantPoses.filter(function (pose) {
        return pose.asanaUri === asana.uri;
      });
    }

    function joinLabels(labels) {
      if (!labels.length) {
        return '';
      }
      if (labels.length === 1) {
        return labels[0];
      }
      if (labels.length === 2) {
        return labels[0] + ' and ' + labels[1];
      }
      return labels.slice(0, -1).join(', ') + ', and ' + labels[labels.length - 1];
    }

    function getVisualGroupKey(asana) {
      if (!asana || !asana.visual) {
        return '';
      }
      return [asana.visual.kind, asana.visual.page, asana.visual.src].join('::');
    }

    function collectVisualsFromAsanas(items) {
      var groups = createDictionary();

      items
        .map(function (item) {
          return typeof item === 'string' ? (asanasByUri[item] || getAsana(item)) : item;
        })
        .filter(Boolean)
        .filter(function (asana) {
          return Boolean(asana.visual);
        }).forEach(function (asana) {
          var key = getVisualGroupKey(asana);
          var group = groups[key];
          if (!key) {
            return;
          }
          if (!group) {
            group = groups[key] = {
              kind: asana.visual.kind,
              page: asana.visual.page,
              src: asana.visual.src,
              asanaUris: [],
              asanaLabels: []
            };
          }
          addUniqueValue(group.asanaUris, asana.uri, function (value) {
            return value;
          });
          addUniqueValue(group.asanaLabels, asana.label, function (value) {
            return normalizeKey(value);
          });
        });

      return Object.keys(groups).map(function (key) {
        var group = groups[key];
        var labels = group.asanaLabels.slice().sort(compareStrings);
        var sharedText = joinLabels(labels);
        return {
          kind: group.kind,
          asanaUri: group.asanaUris[0],
          asanaUris: group.asanaUris.slice(),
          asanaLabel: labels.join(' / '),
          asanaLabels: labels,
          page: group.page,
          src: group.src,
          alt: labels.length === 1
            ? labels[0] + ' visual reference from CYP page ' + group.page
            : 'Shared CYP page ' + group.page + ' reference for ' + sharedText,
          caption: labels.length === 1
            ? 'CYP page ' + group.page
            : 'Shared CYP page ' + group.page + ' for ' + sharedText
        };
      }).sort(function (left, right) {
        return compareNumbers(left.page, right.page) || compareStrings(left.asanaLabel, right.asanaLabel);
      });
    }

    function collectVisualsFromPoses(items) {
      return collectVisualsFromAsanas(items.map(function (pose) {
        return pose && pose.asanaUri;
      }));
    }

    function getRepeatedPosePairs(variantRef) {
      var variant = typeof variantRef === 'string' ? getVariant(variantRef) : variantRef;
      var relevantPoses = variant ? getOrderedPosesForVariant(variant) : poses.slice();
      var seen = createDictionary();
      var pairs = [];

      relevantPoses.forEach(function (pose) {
        pose.repeatedPoseUris.forEach(function (otherUri) {
          var other = posesByUri[otherUri];
          var ordered;
          var key;
          if (!other) {
            return;
          }
          if (variant && other.variantUri !== variant.uri) {
            return;
          }
          ordered = [pose, other].sort(function (left, right) {
            return compareNumbers(left.poseNumber, right.poseNumber) || compareStrings(left.label, right.label);
          });
          key = ordered[0].uri + '::' + ordered[1].uri;
          if (seen[key]) {
            return;
          }
          seen[key] = true;
          pairs.push({
            firstPose: ordered[0],
            secondPose: ordered[1],
            visuals: collectVisualsFromPoses(ordered)
          });
        });
      });

      return pairs.sort(function (left, right) {
        return compareNumbers(left.firstPose.poseNumber, right.firstPose.poseNumber) ||
          compareNumbers(left.secondPose.poseNumber, right.secondPose.poseNumber);
      });
    }

    function getInversePosePairs(variantRef) {
      var variant = typeof variantRef === 'string' ? getVariant(variantRef) : variantRef;
      var relevantPoses = variant ? getOrderedPosesForVariant(variant) : poses.slice();
      var seen = createDictionary();
      var pairs = [];

      relevantPoses.forEach(function (pose) {
        pose.inversePoseUris.forEach(function (otherUri) {
          var other = posesByUri[otherUri];
          var ordered;
          var key;
          if (!other) {
            return;
          }
          if (variant && other.variantUri !== variant.uri) {
            return;
          }
          ordered = [pose, other].sort(function (left, right) {
            return compareNumbers(left.poseNumber, right.poseNumber) || compareStrings(left.label, right.label);
          });
          key = ordered[0].uri + '::' + ordered[1].uri;
          if (seen[key]) {
            return;
          }
          seen[key] = true;
          pairs.push({
            firstPose: ordered[0],
            secondPose: ordered[1],
            visuals: collectVisualsFromPoses(ordered)
          });
        });
      });

      return pairs.sort(function (left, right) {
        return compareNumbers(left.firstPose.poseNumber, right.firstPose.poseNumber) ||
          compareNumbers(left.secondPose.poseNumber, right.secondPose.poseNumber);
      });
    }

    function getSharedAsanas(minimumVariantCount) {
      var threshold = Number(minimumVariantCount || 2);
      return asanas.map(function (asana) {
        var relatedPoses = poses.filter(function (pose) {
          return pose.asanaUri === asana.uri;
        });
        var variantUris = uniqueByKey(relatedPoses.map(function (pose) {
          return variantsByUri[pose.variantUri];
        }).filter(Boolean), function (variant) {
          return variant.uri;
        }).sort(function (left, right) {
          return compareStrings(left.displayLabel, right.displayLabel);
        });
        return {
          asana: asana,
          poses: relatedPoses,
          variants: variantUris,
          visuals: collectVisualsFromAsanas([asana])
        };
      }).filter(function (entry) {
        return entry.variants.length >= threshold;
      }).sort(function (left, right) {
        return right.variants.length - left.variants.length || compareStrings(left.asana.label, right.asana.label);
      });
    }

    function getEquivalentAsanaPairs() {
      var seen = createDictionary();
      var pairs = [];

      asanas.forEach(function (asana) {
        asana.sameAsanaUris.forEach(function (otherUri) {
          var other = asanasByUri[otherUri];
          var ordered;
          var key;
          if (!other) {
            return;
          }
          ordered = [asana, other].sort(function (left, right) {
            return compareStrings(left.label, right.label);
          });
          key = ordered[0].uri + '::' + ordered[1].uri;
          if (seen[key]) {
            return;
          }
          seen[key] = true;
          pairs.push({
            primary: ordered[0],
            secondary: ordered[1],
            visuals: collectVisualsFromAsanas(ordered)
          });
        });
      });

      return pairs.sort(function (left, right) {
        return compareStrings(left.primary.label, right.primary.label) ||
          compareStrings(left.secondary.label, right.secondary.label);
      });
    }

    function getPosesWithMantraAndChakra(variantRef) {
      return getOrderedPosesForVariant(variantRef).filter(function (pose) {
        return Boolean(pose.mantra && pose.chakra);
      });
    }

    function getAsanasWithVisuals() {
      return asanas.filter(function (asana) {
        return Boolean(asana.visual);
      }).slice().sort(function (left, right) {
        return compareNumbers(left.cypPage, right.cypPage) || compareStrings(left.label, right.label);
      });
    }

    function getPoseGuidance(ref) {
      var pose = typeof ref === 'string' ? getPose(ref) : ref;
      var rulesForPose;
      var constraintsForPose;
      var errorsForPose;
      var correctionsForPose;
      if (!pose) {
        return null;
      }

      rulesForPose = pose.ruleUris.map(function (uri) {
        return rulesByUri[uri];
      }).filter(Boolean);

      constraintsForPose = pose.constraintUris.map(function (uri) {
        return constraintsByUri[uri];
      }).filter(Boolean);

      errorsForPose = pose.errorUris.map(function (uri) {
        var error = errorsByUri[uri];
        if (!error) {
          return null;
        }
        return {
          uri: error.uri,
          id: error.id,
          label: error.label,
          description: error.description,
          corrections: error.correctionUris.map(function (correctionUri) {
            return correctionsByUri[correctionUri];
          }).filter(Boolean)
        };
      }).filter(Boolean);

      correctionsForPose = uniqueByKey(errorsForPose.reduce(function (accumulator, error) {
        return accumulator.concat(error.corrections);
      }, []), function (correction) {
        return correction.uri;
      });

      return {
        pose: pose,
        asana: asanasByUri[pose.asanaUri] || null,
        variant: variantsByUri[pose.variantUri] || null,
        rules: rulesForPose,
        constraints: constraintsForPose,
        errors: errorsForPose,
        corrections: correctionsForPose,
        bodyParts: pose.bodyPartUris.map(function (uri) {
          return bodyPartsByUri[uri];
        }).filter(Boolean),
        visuals: collectVisualsFromPoses([pose])
      };
    }

    return {
      options: mergedOptions,
      predicates: PREDICATES,
      types: TYPES,
      entities: entities,
      triples: triples,
      asanas: asanas,
        bodyParts: bodyParts,
        breathingPatterns: breathingPatterns,
        corrections: corrections,
      errors: errors,
      poses: poses,
      rules: rules,
      constraints: constraints,
      variants: variants,
      getEntity: getEntity,
      getEntityLabel: getEntityLabel,
      getEntityLabelsByLanguage: getEntityLabelsByLanguage,
      getEntityComment: getEntityComment,
      getBaseVariant: getBaseVariant,
      getVariant: getVariant,
      getAsana: getAsana,
      getPose: getPose,
      getError: getError,
      getRule: getRule,
      getConstraint: getConstraint,
      getCorrection: getCorrection,
      getBodyPart: getBodyPart,
      getBreathingPattern: getBreathingPattern,
      getAsanaLabel: getAsanaLabel,
      getBreathingPatternLabel: getBreathingPatternLabel,
      getOrderedPosesForVariant: getOrderedPosesForVariant,
      getPoseByNumber: getPoseByNumber,
      getPosesForAsana: getPosesForAsana,
      getRepeatedPosePairs: getRepeatedPosePairs,
      getInversePosePairs: getInversePosePairs,
      getSharedAsanas: getSharedAsanas,
      getEquivalentAsanaPairs: getEquivalentAsanaPairs,
      getPosesWithMantraAndChakra: getPosesWithMantraAndChakra,
      getAsanasWithVisuals: getAsanasWithVisuals,
      getPoseGuidance: getPoseGuidance,
      collectVisualsFromAsanas: collectVisualsFromAsanas,
      collectVisualsFromPoses: collectVisualsFromPoses
    };
  }

  function load(options) {
    var mergedOptions = {
      ontologySrc: options && options.ontologySrc ? options.ontologySrc : DEFAULTS.ontologySrc,
      cypImageBase: options && options.cypImageBase ? options.cypImageBase : DEFAULTS.cypImageBase
    };
    var cacheKey = mergedOptions.ontologySrc + '|' + mergedOptions.cypImageBase;

    if (!options || !options.forceReload) {
      if (cache[cacheKey]) {
        return cache[cacheKey];
      }
    }

    cache[cacheKey] = fetch(mergedOptions.ontologySrc).then(function (response) {
      if (!response.ok) {
        throw new Error('Unable to load ontology from ' + mergedOptions.ontologySrc + ' (' + response.status + ').');
      }
      return response.text();
    }).then(function (xmlText) {
      return parseOntologyText(xmlText, mergedOptions);
    });

    return cache[cacheKey];
  }

  function clearCache() {
    Object.keys(cache).forEach(function (key) {
      delete cache[key];
    });
  }

  global.SNOntologyGraph = {
    DEFAULTS: DEFAULTS,
    PREDICATES: PREDICATES,
    TYPES: TYPES,
    load: load,
    parseOntologyText: parseOntologyText,
    clearCache: clearCache,
    prettifyIdentifier: prettifyIdentifier
  };
}(window));
