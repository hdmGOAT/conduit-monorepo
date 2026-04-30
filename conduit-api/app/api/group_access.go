package api

import (
	"context"
	"database/sql"
	"errors"

	"conduit-monorepo/conduit-api/internal/db"

	"github.com/jackc/pgx/v5"
)

func resolveGroupAccess(ctx context.Context, q db.Querier, userID, groupID int64) (db.Group, db.MembershipRole, error) {
	grp, err := q.GetGroupByID(ctx, groupID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
			return db.Group{}, "", err
		}
		return db.Group{}, "", err
	}

	if grp.OwnerID == userID {
		return grp, db.MembershipRoleAdmin, nil
	}

	memberships, err := q.ListGroupMemberships(ctx, groupID)
	if err != nil {
		return grp, "", err
	}
	for _, membership := range memberships {
		if membership.UserID == userID {
			return grp, membership.Role, nil
		}
	}

	return grp, "", nil
}
