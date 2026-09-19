// server/middleware/query.js
// Enterprise query parser for pagination, sorting, and multi-field filtering

/**
 * Parses pagination query parameters.
 */
function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
    const rawPage = parseInt(query.page, 10);
    const rawLimit = parseInt(query.limit, 10);

    const page = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
    let limit = !isNaN(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit;
    if (limit > maxLimit) limit = maxLimit;

    const offset = (page - 1) * limit;

    return {
        page,
        limit,
        offset,
        cursor: query.cursor ? String(query.cursor).trim() : null
    };
}

/**
 * Generates pagination metadata for API response.
 */
function buildPaginationMeta(totalRecords, page, limit) {
    const total = Math.max(0, parseInt(totalRecords, 10) || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
        page,
        limit,
        totalRecords: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
    };
}

/**
 * Parses and safely whitelists sorting parameters.
 */
function parseSorting(query, allowedFields = ['id', 'created_at'], defaultSort = 'id', defaultOrder = 'DESC') {
    let sortBy = defaultSort;
    let sortOrder = defaultOrder.toUpperCase();

    if (query.sort) {
        // Formats supported: "created_at:desc", "created_at:asc", "created_at,desc", "-created_at"
        let sortParam = String(query.sort).trim();
        if (sortParam.startsWith('-')) {
            sortBy = sortParam.substring(1);
            sortOrder = 'DESC';
        } else if (sortParam.includes(':')) {
            const [field, dir] = sortParam.split(':');
            sortBy = field;
            sortOrder = (dir || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        } else if (sortParam.includes(',')) {
            const [field, dir] = sortParam.split(',');
            sortBy = field;
            sortOrder = (dir || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        } else {
            sortBy = sortParam;
            sortOrder = 'ASC';
        }
    } else {
        if (query.sortBy) sortBy = String(query.sortBy).trim();
        if (query.sortOrder) {
            sortOrder = String(query.sortOrder).trim().toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        }
    }

    // Strict whitelist check to prevent SQL injection
    if (!allowedFields.includes(sortBy)) {
        sortBy = defaultSort;
        sortOrder = defaultOrder.toUpperCase();
    }
    if (sortOrder !== 'ASC' && sortOrder !== 'DESC') {
        sortOrder = 'DESC';
    }

    return {
        sortBy,
        sortOrder,
        orderClause: `${sortBy} ${sortOrder}`
    };
}

/**
 * Builds safe WHERE clauses and parameter list for standard search & date filtering.
 */
function parseFilters(query, config = {}) {
    const {
        searchFields = [],
        exactFields = [],
        dateColumn = 'created_at',
        tableAlias = ''
    } = config;

    const whereClauses = [];
    const params = [];
    const prefix = tableAlias ? `${tableAlias}.` : '';

    // 1. Text Search (ILIKE / LIKE)
    if (query.search && searchFields.length > 0) {
        const searchTerm = `%${String(query.search).trim()}%`;
        const searchClauses = searchFields.map(f => `${prefix}${f} LIKE ?`);
        whereClauses.push(`(${searchClauses.join(' OR ')})`);
        for (let i = 0; i < searchFields.length; i++) {
            params.push(searchTerm);
        }
    }

    // 2. Exact match fields (e.g. status, branch_id, category_id)
    for (const field of exactFields) {
        if (query[field] !== undefined && query[field] !== '') {
            whereClauses.push(`${prefix}${field} = ?`);
            params.push(query[field]);
        }
    }

    // 3. Date Range
    if (query.date_from) {
        whereClauses.push(`${prefix}${dateColumn} >= ?`);
        params.push(query.date_from);
    }
    if (query.date_to) {
        whereClauses.push(`${prefix}${dateColumn} <= ?`);
        params.push(query.date_to);
    }

    return {
        whereClauses,
        params,
        whereSql: whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    };
}

/**
 * Middleware that parses pagination and sorting into req.queryMeta
 */
function queryParser(config = {}) {
    return (req, res, next) => {
        const pagination = parsePagination(req.query, config.defaultLimit, config.maxLimit);
        const sorting = parseSorting(req.query, config.allowedSortFields, config.defaultSort, config.defaultOrder);

        req.pagination = pagination;
        req.sorting = sorting;
        req.buildPaginationMeta = (total) => buildPaginationMeta(total, pagination.page, pagination.limit);

        next();
    };
}

module.exports = {
    parsePagination,
    buildPaginationMeta,
    parseSorting,
    parseFilters,
    queryParser
};
