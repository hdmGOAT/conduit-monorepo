package api

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

type fieldErrorDetail struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func respondValidationError(c *gin.Context, err error) {
	var validationErrs validator.ValidationErrors
	if errors.As(err, &validationErrs) {
		details := make([]fieldErrorDetail, 0, len(validationErrs))
		for _, fe := range validationErrs {
			details = append(details, fieldErrorDetail{
				Field:   toSnakeCase(fe.Field()),
				Message: validationMessage(fe),
			})
		}
		c.JSON(400, gin.H{"error": "invalid request", "details": details})
		return
	}

	c.JSON(400, gin.H{"error": "invalid request", "details": []fieldErrorDetail{{Field: "request", Message: "malformed payload"}}})
}

func respondFieldValidationError(c *gin.Context, field, message string) {
	c.JSON(400, gin.H{
		"error": "invalid request",
		"details": []fieldErrorDetail{{
			Field:   field,
			Message: message,
		}},
	})
}

func validationMessage(fe validator.FieldError) string {
	switch fe.Tag() {
	case "required":
		return "is required"
	case "email":
		return "must be a valid email"
	case "url":
		return "must be a valid URL"
	case "min":
		return fmt.Sprintf("must be at least %s characters", fe.Param())
	default:
		return "is invalid"
	}
}

var matchFirstCap = regexp.MustCompile("(.)([A-Z][a-z]+)")
var matchAllCap = regexp.MustCompile("([a-z0-9])([A-Z])")

func toSnakeCase(s string) string {
	snake := matchFirstCap.ReplaceAllString(s, "${1}_${2}")
	snake = matchAllCap.ReplaceAllString(snake, "${1}_${2}")
	return strings.ToLower(snake)
}
