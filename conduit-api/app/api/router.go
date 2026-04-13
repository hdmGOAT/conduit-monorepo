package api

import (
	"net/http"

	"conduit-monorepo/conduit-api/app/api/middleware"

	"github.com/gin-gonic/gin"
)

func NewRouter(authHandler *AuthHandler, authService middleware.AccessTokenParser) *gin.Engine {
	router := gin.Default()

	api := router.Group("/api")

	api.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

	authGroup := api.Group("/auth")
	authGroup.POST("/register", authHandler.Register)
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/refresh", authHandler.Refresh)
	authGroup.POST("/logout", authHandler.Logout)
	authGroup.GET("/me", middleware.RequireAuth(authService), authHandler.Me)

	return router
}
